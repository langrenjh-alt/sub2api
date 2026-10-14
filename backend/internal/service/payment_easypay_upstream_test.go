//go:build unit

package service

import (
	"context"
	"strconv"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/paymentauditlog"
	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/stretchr/testify/require"
)

func TestMatchEasyPayUpstreamPayment(t *testing.T) {
	t.Parallel()

	err := matchEasyPayUpstreamPayment("sub2_42", "GATEWAY123", 650, 650, "CNY", &payment.QueryOrderResponse{
		TradeNo: "GATEWAY123",
		Status:  payment.ProviderStatusPaid,
		Amount:  650,
	})
	require.NoError(t, err)

	cases := []struct {
		name string
		resp *payment.QueryOrderResponse
		want string
	}{
		{name: "missing order", resp: nil, want: "no order"},
		{name: "unpaid", resp: &payment.QueryOrderResponse{TradeNo: "GATEWAY123", Status: payment.ProviderStatusPending, Amount: 650}, want: "not paid"},
		{name: "amount", resp: &payment.QueryOrderResponse{TradeNo: "GATEWAY123", Status: payment.ProviderStatusPaid, Amount: 1}, want: "amount"},
		{name: "trade", resp: &payment.QueryOrderResponse{TradeNo: "OTHER", Status: payment.ProviderStatusPaid, Amount: 650}, want: "trade number"},
		{name: "echoed lookup key", resp: &payment.QueryOrderResponse{TradeNo: "sub2_42", Status: payment.ProviderStatusPaid, Amount: 650}, want: "gateway trade number"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			notifyTradeNo := "GATEWAY123"
			if tt.name == "echoed lookup key" {
				notifyTradeNo = "sub2_42"
			}
			err := matchEasyPayUpstreamPayment("sub2_42", notifyTradeNo, 650, 650, "CNY", tt.resp)
			require.ErrorContains(t, err, tt.want)
		})
	}
}

func TestEasyPayNotificationDoesNotCreditWithoutUpstreamPayment(t *testing.T) {
	ctx := context.Background()
	client := newPaymentConfigServiceTestClient(t)
	order := createPaymentFulfillmentSubscriptionOrder(t, ctx, client, OrderStatusPending, time.Now())
	order, err := client.PaymentOrder.UpdateOneID(order.ID).
		SetOrderType(payment.OrderTypeBalance).
		SetProviderKey(payment.TypeEasyPay).
		ClearPlanID().
		ClearSubscriptionGroupID().
		ClearSubscriptionDays().
		ClearPaidAt().
		Save(ctx)
	require.NoError(t, err)

	originalLookup := lookupOrderPaymentProvider
	lookupOrderPaymentProvider = func(*PaymentService, context.Context, *dbent.PaymentOrder) (payment.Provider, error) {
		return &paymentOrderLifecycleQueryProvider{
			key: payment.TypeEasyPay,
			resp: &payment.QueryOrderResponse{
				TradeNo: order.OutTradeNo,
				Status:  payment.ProviderStatusPending,
			},
		}, nil
	}
	t.Cleanup(func() { lookupOrderPaymentProvider = originalLookup })

	svc := &PaymentService{entClient: client}
	err = svc.HandlePaymentNotification(ctx, &payment.PaymentNotification{
		TradeNo: "FORGED_TRADE",
		OrderID: order.OutTradeNo,
		Amount:  order.PayAmount,
		Status:  payment.NotificationStatusSuccess,
	}, payment.TypeEasyPay)
	require.ErrorContains(t, err, "not paid")

	reloaded, err := client.PaymentOrder.Get(ctx, order.ID)
	require.NoError(t, err)
	require.Equal(t, OrderStatusPending, reloaded.Status)
	auditCount, err := client.PaymentAuditLog.Query().
		Where(
			paymentauditlog.OrderIDEQ(strconv.FormatInt(order.ID, 10)),
			paymentauditlog.ActionEQ("PAYMENT_UPSTREAM_VERIFY_FAILED"),
		).
		Count(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, auditCount)
}
