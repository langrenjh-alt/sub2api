package provider

import (
	"context"
	"testing"
)

func TestEasyPayNotificationRejectsDelimitedRoutingFields(t *testing.T) {
	t.Parallel()
	e := &EasyPay{config: map[string]string{"pid": "1000", "pkey": "test-merchant-key"}}
	for _, key := range []string{"pid", "trade_no", "out_trade_no", "money", "trade_status"} {
		t.Run(key, func(t *testing.T) {
			params := easyPayStandardNotificationParams()
			params[key] += "&injected=value"
			if _, err := e.VerifyNotification(context.Background(), signedEasyPayNotification(params, e.config["pkey"]), nil); err == nil {
				t.Fatalf("delimited routing field %q was accepted", key)
			}
		})
	}
}
