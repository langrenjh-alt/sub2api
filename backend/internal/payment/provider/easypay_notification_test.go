package provider

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
)

// Reproduce issues #7875/#7881 without contacting any payment platform: the
// payer learns only the popup checkout signature, never the merchant key.
func TestEasyPayNotificationRejectsReusedCheckoutSignature(t *testing.T) {
	t.Parallel()

	e := &EasyPay{config: map[string]string{
		"pid": "1000", "pkey": "test-merchant-key", "paymentMode": "popup",
		"apiBase":   "https://pay.example.com",
		"notifyUrl": "https://site.example.com/api/v1/payment/webhook/easypay",
	}}
	const prefix = "https://site.example.com/payment/result?order_id=99&out_trade_no=ORDER123&resume_token=server-token&status=success"
	checkout, err := e.CreatePayment(context.Background(), payment.CreatePaymentRequest{
		OrderID: "ORDER123", Amount: "650.00", Subject: "balance recharge",
		PaymentType: payment.TypeAlipay,
		ReturnURL:   prefix + "&trade_no=FORGED_ORDER123&trade_status=TRADE_SUCCESS",
	})
	if err != nil {
		t.Fatalf("CreatePayment: %v", err)
	}
	checkoutURL, err := url.Parse(checkout.PayURL)
	if err != nil {
		t.Fatalf("parse checkout URL: %v", err)
	}
	callback := checkoutURL.Query()
	callback.Set("return_url", prefix)
	callback.Set("trade_no", "FORGED_ORDER123")
	callback.Set("trade_status", tradeStatusSuccess)

	// The legacy signature algorithm is fixed by the upstream protocol. This
	// assertion ensures the payload actually exploits its ambiguous boundaries.
	params := make(map[string]string, len(callback))
	for key := range callback {
		params[key] = callback.Get(key)
	}
	if !easyPayVerifySign(params, e.config["pkey"], callback.Get("sign")) {
		t.Fatal("PoC must reuse the original checkout signature successfully")
	}
	if n, err := e.VerifyNotification(context.Background(), callback.Encode(), nil); err == nil {
		t.Fatalf("forged callback accepted: order=%s trade=%s amount=%v status=%s", n.OrderID, n.TradeNo, n.Amount, n.Status)
	}
	if _, err := e.VerifyNotification(context.Background(), checkoutURL.RawQuery, nil); err == nil {
		t.Fatal("a complete checkout URL must not be accepted as a notification")
	}
}

func TestEasyPayNotificationAcceptsStandardFields(t *testing.T) {
	t.Parallel()

	e := &EasyPay{config: map[string]string{"pid": "1000", "pkey": "test-merchant-key"}}
	for _, status := range []string{tradeStatusSuccess, "WAIT_BUYER_PAY"} {
		t.Run(status, func(t *testing.T) {
			params := easyPayStandardNotificationParams()
			params["trade_status"] = status
			// Delimiters are legitimate within opaque protocol fields and must
			// remain signed exactly as the upstream specifies.
			params["name"] = "套餐 & credits = 650"
			params["param"] = "opaque&context=value"
			n, err := e.VerifyNotification(context.Background(), signedEasyPayNotification(params, e.config["pkey"]), nil)
			if err != nil {
				t.Fatalf("standard notification rejected: %v", err)
			}
			wantStatus := payment.ProviderStatusFailed
			if status == tradeStatusSuccess {
				wantStatus = payment.ProviderStatusSuccess
			}
			if n.OrderID != "ORDER123" || n.TradeNo != "GATEWAY123" || n.Amount != 650 || n.Status != wantStatus || n.Metadata["pid"] != "1000" {
				t.Fatalf("unexpected notification: %+v", n)
			}
		})
	}
}

func TestEasyPayNotificationRejectsUnexpectedAndDuplicateFields(t *testing.T) {
	t.Parallel()

	e := &EasyPay{config: map[string]string{"pid": "1000", "pkey": "test-merchant-key"}}
	for _, key := range []string{"return_url", "notify_url", "device", "clientip", "cid", "unexpected"} {
		for _, value := range []string{"", "injected"} {
			t.Run("unexpected/"+key+"/"+value, func(t *testing.T) {
				params := easyPayStandardNotificationParams()
				params[key] = value
				if _, err := e.VerifyNotification(context.Background(), signedEasyPayNotification(params, e.config["pkey"]), nil); err == nil {
					t.Fatalf("unexpected field %q must be rejected even when signed or empty", key)
				}
			})
		}
	}
	for _, key := range []string{"sign", "sign_type", "pid", "out_trade_no", "trade_no", "trade_status", "money", "param"} {
		t.Run("duplicate/"+key, func(t *testing.T) {
			raw := signedEasyPayNotification(easyPayStandardNotificationParams(), e.config["pkey"])
			raw += "&" + url.QueryEscape(key) + "=ignored-second-value"
			if _, err := e.VerifyNotification(context.Background(), raw, nil); err == nil {
				t.Fatalf("duplicate field %q must be rejected", key)
			}
		})
	}
}

func TestEasyPayNotificationRejectsInvalidFields(t *testing.T) {
	t.Parallel()

	e := &EasyPay{config: map[string]string{"pid": "1000", "pkey": "test-merchant-key"}}
	for _, key := range []string{"pid", "trade_no", "out_trade_no", "money", "trade_status"} {
		t.Run("missing/"+key, func(t *testing.T) {
			params := easyPayStandardNotificationParams()
			delete(params, key)
			if _, err := e.VerifyNotification(context.Background(), signedEasyPayNotification(params, e.config["pkey"]), nil); err == nil {
				t.Fatalf("missing %q must be rejected", key)
			}
		})
	}
	for _, money := range []string{"NaN", "+Inf", "-Inf", "invalid", "0", "-1"} {
		t.Run("money/"+money, func(t *testing.T) {
			params := easyPayStandardNotificationParams()
			params["money"] = money
			if _, err := e.VerifyNotification(context.Background(), signedEasyPayNotification(params, e.config["pkey"]), nil); err == nil {
				t.Fatalf("invalid money %q must be rejected", money)
			}
		})
	}
	params := easyPayStandardNotificationParams()
	params["pid"] = "another-merchant"
	if _, err := e.VerifyNotification(context.Background(), signedEasyPayNotification(params, e.config["pkey"]), nil); err == nil {
		t.Fatal("another merchant's notification must be rejected")
	}
	raw := signedEasyPayNotification(easyPayStandardNotificationParams(), e.config["pkey"])
	if _, err := e.VerifyNotification(context.Background(), strings.Replace(raw, "MD5", "RSA", 1), nil); err == nil {
		t.Fatal("unsupported signature type must be rejected")
	}
	if _, err := e.VerifyNotification(context.Background(), raw+"&param=%XX", nil); err == nil {
		t.Fatal("malformed query encoding must be rejected")
	}
}

func easyPayStandardNotificationParams() map[string]string {
	return map[string]string{
		"pid": "1000", "trade_no": "GATEWAY123", "out_trade_no": "ORDER123",
		"type": "alipay", "name": "balance recharge", "money": "650.00",
		"trade_status": tradeStatusSuccess, "param": "", "sign_type": signTypeMD5,
	}
}

func signedEasyPayNotification(params map[string]string, key string) string {
	values := url.Values{}
	for name, value := range params {
		values.Set(name, value)
	}
	values.Set("sign", easyPaySign(params, key))
	return values.Encode()
}
