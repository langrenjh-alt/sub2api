package provider

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

func mustTestWebMoneyProvider(t *testing.T, overrides map[string]string) *WebMoney {
	t.Helper()
	cfg := map[string]string{
		"payeePurse": "Z123456789012",
		"secretKey":  "secret",
	}
	for k, v := range overrides {
		cfg[k] = v
	}
	prov, err := NewWebMoney("wm-test", cfg)
	if err != nil {
		t.Fatalf("NewWebMoney returned error: %v", err)
	}
	return prov
}

func decodeTestWebMoneyCheckoutPayload(t *testing.T, payURL string) webMoneyCheckoutPayload {
	t.Helper()
	parsed, err := url.Parse(payURL)
	if err != nil {
		t.Fatalf("parse pay url: %v", err)
	}
	raw := parsed.Query().Get("p")
	if raw == "" {
		t.Fatalf("checkout payload query p is empty in %q", payURL)
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		t.Fatalf("decode checkout payload: %v", err)
	}
	var payload webMoneyCheckoutPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("unmarshal checkout payload: %v", err)
	}
	return payload
}

func signedWebMoneyValues(t *testing.T, prov *WebMoney, overrides map[string]string) url.Values {
	t.Helper()
	values := url.Values{}
	values.Set("LMI_PAYEE_PURSE", prov.config["payeePurse"])
	values.Set("LMI_PAYMENT_AMOUNT", "12.34")
	values.Set("LMI_PAYMENT_NO", "12345")
	values.Set("LMI_MODE", "0")
	values.Set("LMI_SYS_INVS_NO", "9001")
	values.Set("LMI_SYS_TRANS_NO", "7001")
	values.Set("LMI_SYS_TRANS_DATE", "2026-06-28 12:34:56")
	values.Set("LMI_PAYER_PURSE", "Z210987654321")
	values.Set("LMI_PAYER_WM", "123456789012")
	values.Set("LMI_SDP_TYPE", "31")
	values.Set(webMoneyOutTradeNoField, "sub2_order_123")
	for k, v := range overrides {
		values.Set(k, v)
	}
	params := webMoneyValuesToMap(values)
	values.Set(webMoneyHashFieldSHA256, webMoneySHA256Hex(webMoneySignatureString(params, prov.config["secretKey"], true, params[webMoneyHoldField])))
	return values
}

func TestWebMoneyCreatePaymentBuildsMerchantFormPayload(t *testing.T) {
	t.Parallel()

	prov := mustTestWebMoneyProvider(t, map[string]string{
		"allowSdp": "31",
		"simMode":  "0",
	})
	resp, err := prov.CreatePayment(context.Background(), payment.CreatePaymentRequest{
		OrderID:    "12345",
		OutTradeNo: "sub2_order_123",
		Amount:     "12.34",
		Subject:    "Sub2API recharge",
		ReturnURL:  "https://app.example.com/payment/result?order_id=12345",
	})
	if err != nil {
		t.Fatalf("CreatePayment returned error: %v", err)
	}
	if resp.Currency != "USD" {
		t.Fatalf("Currency = %q, want USD", resp.Currency)
	}
	payload := decodeTestWebMoneyCheckoutPayload(t, resp.PayURL)
	if payload.Action != webMoneyDefaultPaymentURL {
		t.Fatalf("Action = %q, want %q", payload.Action, webMoneyDefaultPaymentURL)
	}
	if payload.Method != webMoneyFormMethodPost {
		t.Fatalf("Method = %q, want %q", payload.Method, webMoneyFormMethodPost)
	}

	wantFields := map[string]string{
		"LMI_PAYEE_PURSE":       "Z123456789012",
		"LMI_PAYMENT_AMOUNT":    "12.34",
		"LMI_PAYMENT_DESC":      "Sub2API recharge",
		"LMI_PAYMENT_NO":        "12345",
		"LMI_ALLOW_SDP":         "31",
		"LMI_SIM_MODE":          "0",
		webMoneyOutTradeNoField: "sub2_order_123",
	}
	for key, want := range wantFields {
		if got := payload.Fields[key]; got != want {
			t.Fatalf("field %s = %q, want %q", key, got, want)
		}
	}
}

func TestWebMoneyCreatePaymentIncludesHoldAndPaymentFormSign(t *testing.T) {
	t.Parallel()

	x20 := strings.Repeat("x", 50)
	prov := mustTestWebMoneyProvider(t, map[string]string{
		"hold":         "7",
		"secretKeyX20": x20,
	})
	resp, err := prov.CreatePayment(context.Background(), payment.CreatePaymentRequest{
		OrderID:    "12345",
		OutTradeNo: "sub2_order_123",
		Amount:     "12.34",
		Subject:    "Sub2API recharge",
		ReturnURL:  "https://app.example.com/payment/result?order_id=12345",
	})
	if err != nil {
		t.Fatalf("CreatePayment returned error: %v", err)
	}

	payload := decodeTestWebMoneyCheckoutPayload(t, resp.PayURL)
	if got := payload.Fields[webMoneyHoldField]; got != "7" {
		t.Fatalf("%s = %q, want 7", webMoneyHoldField, got)
	}
	wantSign := webMoneySHA256Hex("Z123456789012;12.34;7;12345;" + x20 + ";")
	if got := payload.Fields[webMoneyPaymentFormSign]; got != wantSign {
		t.Fatalf("%s = %q, want %q", webMoneyPaymentFormSign, got, wantSign)
	}
}

func TestWebMoneyRejectsInsecurePaymentURL(t *testing.T) {
	t.Parallel()

	_, err := NewWebMoney("wm-test", map[string]string{
		"payeePurse": "Z123456789012",
		"secretKey":  "secret",
		"paymentUrl": "http://merchant.wmtransfer.com/lmi/payment_utf.asp",
	})
	if err == nil {
		t.Fatal("NewWebMoney returned nil error, want https paymentUrl validation error")
	}
	if got := err.Error(); !strings.Contains(got, "https") {
		t.Fatalf("error = %q, want https validation detail", got)
	}
}

func TestWebMoneyRejectsInvalidSecretKeyX20LengthAsBadRequest(t *testing.T) {
	t.Parallel()

	_, err := NewWebMoney("wm-test", map[string]string{
		"payeePurse":   "Z123456789012",
		"secretKey":    "secret",
		"secretKeyX20": strings.Repeat("x", 49),
	})
	if err == nil {
		t.Fatal("NewWebMoney returned nil error, want invalid secretKeyX20 error")
	}
	if !infraerrors.IsBadRequest(err) {
		t.Fatalf("NewWebMoney error = %v, want bad request", err)
	}
	if got := err.Error(); got == "" || !strings.Contains(got, "secretKeyX20") {
		t.Fatalf("error = %q, want secretKeyX20 detail", got)
	}
}

func TestWebMoneyVerifyNotificationWithHash2Success(t *testing.T) {
	t.Parallel()

	prov := mustTestWebMoneyProvider(t, nil)
	values := signedWebMoneyValues(t, prov, nil)

	notification, err := prov.VerifyNotification(context.Background(), values.Encode(), nil)
	if err != nil {
		t.Fatalf("VerifyNotification returned error: %v", err)
	}
	if notification == nil {
		t.Fatal("VerifyNotification returned nil notification")
	}
	if notification.TradeNo != "7001" {
		t.Fatalf("TradeNo = %q, want 7001", notification.TradeNo)
	}
	if notification.OrderID != "sub2_order_123" {
		t.Fatalf("OrderID = %q, want sub2_order_123", notification.OrderID)
	}
	if notification.Status != payment.ProviderStatusSuccess {
		t.Fatalf("Status = %q, want success", notification.Status)
	}
	if notification.Metadata["payee_purse"] != "Z123456789012" {
		t.Fatalf("metadata payee_purse = %q", notification.Metadata["payee_purse"])
	}
	if notification.Metadata["currency"] != "USD" {
		t.Fatalf("metadata currency = %q, want USD", notification.Metadata["currency"])
	}
}

func TestWebMoneyVerifyNotificationWithHoldHash2Success(t *testing.T) {
	t.Parallel()

	prov := mustTestWebMoneyProvider(t, map[string]string{"hold": "7"})
	values := signedWebMoneyValues(t, prov, map[string]string{webMoneyHoldField: "7"})

	notification, err := prov.VerifyNotification(context.Background(), values.Encode(), nil)
	if err != nil {
		t.Fatalf("VerifyNotification returned error: %v", err)
	}
	if notification == nil {
		t.Fatal("VerifyNotification returned nil notification")
	}
	if notification.Status != payment.ProviderStatusSuccess {
		t.Fatalf("Status = %q, want success", notification.Status)
	}
}

func TestWebMoneyVerifyNotificationPreRequestReturnsNil(t *testing.T) {
	t.Parallel()

	prov := mustTestWebMoneyProvider(t, nil)
	values := url.Values{}
	values.Set(webMoneyPreRequestField, webMoneyPreRequestValue)
	values.Set("LMI_PAYMENT_NO", "12345")

	notification, err := prov.VerifyNotification(context.Background(), values.Encode(), nil)
	if err != nil {
		t.Fatalf("VerifyNotification returned error: %v", err)
	}
	if notification != nil {
		t.Fatalf("notification = %#v, want nil", notification)
	}
}

func TestWebMoneyVerifyNotificationTestModeIsNotSuccess(t *testing.T) {
	t.Parallel()

	prov := mustTestWebMoneyProvider(t, nil)
	values := signedWebMoneyValues(t, prov, map[string]string{"LMI_MODE": "1"})

	notification, err := prov.VerifyNotification(context.Background(), values.Encode(), nil)
	if err != nil {
		t.Fatalf("VerifyNotification returned error: %v", err)
	}
	if notification == nil {
		t.Fatal("VerifyNotification returned nil notification")
	}
	if notification.Status == payment.ProviderStatusSuccess {
		t.Fatalf("Status = %q, want non-success for test mode", notification.Status)
	}
	if notification.Metadata["lmi_mode"] != "1" {
		t.Fatalf("metadata lmi_mode = %q, want 1", notification.Metadata["lmi_mode"])
	}
}

func TestWebMoneyVerifyNotificationRejectsUnexpectedSDPType(t *testing.T) {
	t.Parallel()

	prov := mustTestWebMoneyProvider(t, map[string]string{"allowSdp": "31"})
	values := signedWebMoneyValues(t, prov, map[string]string{"LMI_SDP_TYPE": "28"})

	_, err := prov.VerifyNotification(context.Background(), values.Encode(), nil)
	if err == nil {
		t.Fatal("VerifyNotification returned nil error, want SDP mismatch")
	}
	if got := err.Error(); got == "" || !containsAll(got, []string{"LMI_SDP_TYPE", "expected 31", "got 28"}) {
		t.Fatalf("error = %q, want SDP mismatch details", got)
	}
}

func containsAll(s string, parts []string) bool {
	for _, part := range parts {
		if !strings.Contains(s, part) {
			return false
		}
	}
	return true
}
