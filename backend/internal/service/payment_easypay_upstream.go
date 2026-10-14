package service

import (
	"context"
	"fmt"
	"math"
	"strings"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/payment"
)

// lookupOrderPaymentProvider resolves the provider that created the order.
// Tests replace it to exercise the credit gate without a live gateway.
var lookupOrderPaymentProvider = func(s *PaymentService, ctx context.Context, order *dbent.PaymentOrder) (payment.Provider, error) {
	if s == nil {
		return nil, fmt.Errorf("payment service is missing")
	}
	return s.getOrderProvider(ctx, order)
}

func paymentOrderRequiresEasyPayUpstreamVerify(order *dbent.PaymentOrder, providerKey string) bool {
	if order == nil {
		return false
	}
	candidates := []string{
		strings.TrimSpace(providerKey),
		strings.TrimSpace(psStringValue(order.ProviderKey)),
	}
	if snapshot := psOrderProviderSnapshot(order); snapshot != nil {
		candidates = append(candidates, strings.TrimSpace(snapshot.ProviderKey))
	}
	for _, candidate := range candidates {
		if payment.GetBasePaymentType(candidate) == payment.TypeEasyPay {
			return true
		}
	}
	return false
}

// verifyEasyPayUpstreamPayment refuses to credit an EasyPay order unless the
// order's own gateway reports that this out_trade_no is paid for the same
// amount and gateway trade number. A checkout signature reused as a notify
// callback cannot satisfy this check, and neither can a leaked merchant key.
func (s *PaymentService) verifyEasyPayUpstreamPayment(ctx context.Context, order *dbent.PaymentOrder, tradeNo string, paid float64, providerKey string) error {
	if !paymentOrderRequiresEasyPayUpstreamVerify(order, providerKey) {
		return nil
	}
	prov, err := lookupOrderPaymentProvider(s, ctx, order)
	if err != nil || prov == nil {
		return fmt.Errorf("easypay upstream provider unavailable")
	}
	if payment.GetBasePaymentType(prov.ProviderKey()) != payment.TypeEasyPay {
		return fmt.Errorf("easypay upstream provider mismatch")
	}
	resp, err := prov.QueryOrder(ctx, strings.TrimSpace(order.OutTradeNo))
	if err != nil {
		return fmt.Errorf("easypay upstream query failed: %w", err)
	}
	return matchEasyPayUpstreamPayment(order.OutTradeNo, tradeNo, order.PayAmount, paid, PaymentOrderCurrency(order), resp)
}

func matchEasyPayUpstreamPayment(outTradeNo, notifyTradeNo string, orderAmount, notifyAmount float64, currency string, resp *payment.QueryOrderResponse) error {
	if resp == nil {
		return fmt.Errorf("easypay upstream returned no order")
	}
	if resp.Status != payment.ProviderStatusPaid {
		return fmt.Errorf("easypay upstream order is not paid")
	}
	tolerance := paymentAmountToleranceForCurrency(currency)
	if !isValidProviderAmount(resp.Amount) ||
		math.Abs(resp.Amount-orderAmount) > tolerance ||
		math.Abs(resp.Amount-notifyAmount) > tolerance {
		return fmt.Errorf("easypay upstream amount mismatch")
	}
	upstreamTradeNo := strings.TrimSpace(resp.TradeNo)
	notifyTradeNo = strings.TrimSpace(notifyTradeNo)
	outTradeNo = strings.TrimSpace(outTradeNo)
	if upstreamTradeNo == "" || notifyTradeNo == "" || upstreamTradeNo != notifyTradeNo {
		return fmt.Errorf("easypay upstream trade number mismatch")
	}
	// QueryOrder echoes the lookup key when the gateway omits trade_no.
	// That is not a real gateway trade number and must not authorize credit.
	if upstreamTradeNo == outTradeNo {
		return fmt.Errorf("easypay upstream did not return a gateway trade number")
	}
	return nil
}
