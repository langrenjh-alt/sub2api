package provider

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
)

func TestBEpusdtCreatePaymentSignsJSONNumbersAsFloat64(t *testing.T) {
	const token = "test-token"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Fatal(err)
		}
		// This mirrors BEpusdt's map[string]any JSON decoding before signing.
		if got, want := payload["signature"], bepusdtSign(payload, token); got != want {
			t.Fatalf("signature = %v, want %s; payload = %s", got, want, body)
		}
		_, _ = w.Write([]byte(`{"status_code":200,"message":"success","data":{"trade_id":"trade-1","payment_url":"https://pay.example/checkout/trade-1"}}`))
	}))
	defer server.Close()

	prov, err := NewBEpusdt("1", map[string]string{
		"apiBase":   server.URL,
		"token":     token,
		"notifyUrl": "https://merchant.example/api/v1/payment/webhook/bepusdt",
		"returnUrl": "https://merchant.example/payment/result",
	})
	if err != nil {
		t.Fatal(err)
	}
	resp, err := prov.CreatePayment(context.Background(), payment.CreatePaymentRequest{
		OrderID: "order-1",
		Amount:  "10.00",
		Subject: "Sub2API 10.00 CNY",
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.TradeNo != "trade-1" || resp.PayURL == "" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestBEpusdtValueStringNormalizesJSONNumbers(t *testing.T) {
	for _, tc := range []struct {
		input, want string
	}{
		{input: "10.00", want: "10"},
		{input: "10.50", want: "10.5"},
	} {
		if got := bepusdtValueString(json.Number(tc.input)); got != tc.want {
			t.Errorf("bepusdtValueString(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}
