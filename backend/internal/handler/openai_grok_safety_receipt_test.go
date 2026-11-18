//go:build unit

package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/ctxkey"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

type grokFeeUpstream struct {
	service.HTTPUpstream
	body  string
	calls int
}

func (u *grokFeeUpstream) Do(*http.Request, string, int64, int) (*http.Response, error) {
	u.calls++
	return &http.Response{StatusCode: 403, Header: http.Header{"Content-Type": {"application/json"}, "X-Request-Id": {"provider-id"}},
		Body: io.NopCloser(strings.NewReader(u.body))}, nil
}

type grokFeeLedger struct {
	service.UsageBillingRepository
	writes []*service.UsageBillingCommand
	fail   bool
}

type grokFeeCache struct{ *handlerInflightCache }

func (grokFeeCache) DeductUserBalance(context.Context, int64, float64) error { return nil }

func (l *grokFeeLedger) Apply(_ context.Context, cmd *service.UsageBillingCommand) (*service.UsageBillingApplyResult, error) {
	l.writes = append(l.writes, cmd)
	if l.fail {
		return nil, errors.New("test ledger offline")
	}
	return &service.UsageBillingApplyResult{Applied: true}, nil
}

// Exercise the actual HTTP handler, upstream adapter, billing calculation, and
// response serialization. Only network, storage and balance cache are doubles.
func runGrokFeeHTTP(t *testing.T, endpoint, rejected string, stream, enabled bool, amount float64, fail bool) (*httptest.ResponseRecorder, *grokFeeLedger, []*service.UsageLog) {
	t.Helper()
	gid := int64(951)
	group := &service.Group{ID: gid, Platform: service.PlatformGrok, Status: service.StatusActive, RateMultiplier: 1}
	key := &service.APIKey{ID: 952, UserID: 953, User: &service.User{ID: 953, Balance: 100, Status: service.StatusActive}, GroupID: &gid, Group: group}
	cfg := &config.Config{}
	cfg.Default.RateMultiplier = 1
	cfg.Gateway.Grok.SafetyRejectionBilling = config.GatewayGrokSafetyRejectionBillingConfig{
		Enabled: enabled, AmountUSD: amount, CacheReadRatioMin: 0.95, CacheReadRatioMax: 0.95, OutputTokensMin: 64, OutputTokensMax: 64}
	account := service.Account{ID: 954, Platform: service.PlatformGrok, Type: service.AccountTypeAPIKey, Status: service.StatusActive, Schedulable: true, Concurrency: 2,
		Credentials: map[string]any{"api_key": "fixture-key"}}
	repo := &grokCredentialHandlerRepo{accounts: []service.Account{account}}
	cache := service.NewBillingCacheService(grokFeeCache{newHandlerInflightCache(100)}, nil, nil, nil, nil, nil, cfg, nil)
	t.Cleanup(cache.Stop)
	u := &grokFeeUpstream{body: rejected}
	l := &grokFeeLedger{fail: fail}
	rows := &openAIWSUsageHandlerUsageLogRepoStub{created: make(chan *service.UsageLog, 8)}
	gw := service.NewOpenAIGatewayService(repo, rows, l, nil, nil, nil, nil, cfg, nil, nil, service.NewBillingService(cfg, nil), nil, cache, u, &service.DeferredService{}, nil, nil, nil, nil, nil, nil, nil)
	h := NewOpenAIGatewayHandler(gw, service.NewConcurrencyService(&fakeConcurrencyCache{}), cache, &service.APIKeyService{}, nil, nil, nil, nil, cfg)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(middleware.ContextKeyAPIKey), key)
		c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: key.User.ID, Concurrency: 2})
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), ctxkey.ClientRequestID, "original-req"))
		c.Header("X-Client-Request-Id", "original-req")
		c.Next()
	})
	router.POST(EndpointResponses, h.Responses)
	router.POST(EndpointMessages, h.Messages)
	router.POST(EndpointChatCompletions, h.ChatCompletions)
	field := `"messages":[{"role":"user","content":"hello"}],"max_tokens":16`
	if endpoint == EndpointResponses {
		field = `"input":"hello"`
	}
	req := httptest.NewRequest("POST", endpoint, strings.NewReader(fmt.Sprintf(`{"model":"grok-4.6","stream":%t,%s}`, stream, field)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, 1, u.calls, "must settle on the original attempt: %s", rec.Body.String())
	out := []*service.UsageLog{}
	for len(rows.created) > 0 {
		out = append(out, <-rows.created)
	}
	return rec, l, out
}

const grokFeeTestError = `{"error":{"code":"safety_review_rejected","message":"provider diagnostic"}}`

func TestGrokSafetyOriginalRequestUsage(t *testing.T) {
	for _, ep := range []string{EndpointResponses, EndpointChatCompletions, EndpointMessages} {
		for _, stream := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/stream=%t", ep, stream), func(t *testing.T) {
				rec, l, rows := runGrokFeeHTTP(t, ep, grokFeeTestError, stream, true, 0.05, false)
				require.Equal(t, 200, rec.Code, rec.Body.String())
				require.Len(t, l.writes, 1)
				require.Len(t, rows, 1)
				row, cmd := rows[0], l.writes[0]
				require.Equal(t, int64(953), row.UserID)
				require.Equal(t, int64(952), row.APIKeyID)
				require.Equal(t, "client:original-req", row.RequestID)
				require.Equal(t, row.RequestID, cmd.RequestID)
				require.Equal(t, row.RequestID, rec.Header().Get("X-Sub2API-Billing-Request-Id"))
				require.Equal(t, "safety_review_rejected", rec.Header().Get("X-Sub2API-Rejection-Code"))
				require.Equal(t, stream, row.Stream)
				require.InDelta(t, 0.05, cmd.BalanceCost, 0.00002)
				require.NotContains(t, rec.Body.String(), "provider diagnostic")
				require.Contains(t, rec.Body.String(), "safety_review_rejected")
				body := rec.Body.String()
				wire := gjson.Parse(body)
				var start, end gjson.Result
				if stream {
					require.Contains(t, rec.Result().Header.Get("Content-Type"), "text/event-stream")
					for _, line := range strings.Split(body, "\n") {
						if !strings.HasPrefix(line, "data:") {
							continue
						}
						payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
						if payload == "[DONE]" {
							continue
						}
						require.True(t, gjson.Valid(payload), payload)
						data := gjson.Parse(payload)
						switch data.Get("type").String() {
						case "message_start":
							start = data.Get("message")
						case "message_delta":
							end = data
						case "response.completed":
							wire = data.Get("response")
						default:
							if data.Get("usage").Exists() {
								wire = data
							}
						}
					}
				}
				usage := wire.Get("usage")
				switch ep {
				case EndpointChatCompletions:
					if stream {
						require.Contains(t, body, "[DONE]")
						require.Len(t, wire.Get("choices").Array(), 0)
					} else {
						require.Equal(t, "content_filter", wire.Get("choices.0.finish_reason").String())
					}
					require.EqualValues(t, row.InputTokens+row.CacheReadTokens, usage.Get("prompt_tokens").Int())
					require.EqualValues(t, row.OutputTokens, usage.Get("completion_tokens").Int())
					require.EqualValues(t, row.CacheReadTokens, usage.Get("prompt_tokens_details.cached_tokens").Int())
				case EndpointResponses:
					require.Equal(t, "refusal", wire.Get("output.0.content.0.type").String())
					require.EqualValues(t, row.InputTokens+row.CacheReadTokens, usage.Get("input_tokens").Int())
					require.EqualValues(t, row.OutputTokens, usage.Get("output_tokens").Int())
					require.EqualValues(t, row.CacheReadTokens, usage.Get("input_tokens_details.cached_tokens").Int())
				case EndpointMessages:
					out := usage.Get("output_tokens")
					if stream {
						usage = start.Get("usage")
						out = end.Get("usage.output_tokens")
						require.Equal(t, "refusal", end.Get("delta.stop_reason").String())
						require.Contains(t, body, "message_stop")
					} else {
						require.Equal(t, "refusal", wire.Get("stop_reason").String())
					}
					require.EqualValues(t, row.InputTokens, usage.Get("input_tokens").Int())
					require.EqualValues(t, row.CacheReadTokens, usage.Get("cache_read_input_tokens").Int())
					require.EqualValues(t, row.OutputTokens, out.Int())
				}
				if ep != EndpointMessages {
					require.EqualValues(t, row.InputTokens+row.CacheReadTokens+row.OutputTokens, usage.Get("total_tokens").Int())
				}
			})
		}
	}
}

func TestGrokSafetyHTTPNoChargeableReceipt(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		enabled    bool
		amount     float64
		fail       bool
	}{
		{"disabled", grokFeeTestError, false, 0.05, false}, {"zero", grokFeeTestError, true, 0, false},
		{"unconfirmed", `{"error":{"code":"new_sensitive","message":"text is sensitive"}}`, true, 0.05, false},
		{"ledger failure", grokFeeTestError, true, 0.05, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec, l, _ := runGrokFeeHTTP(t, EndpointResponses, tc.body, false, tc.enabled, tc.amount, tc.fail)
			require.Equal(t, 403, rec.Code)
			require.False(t, gjson.Get(rec.Body.String(), "usage").Exists())
			require.Empty(t, rec.Header().Get("X-Sub2API-Billing-Request-Id"))
			if tc.fail {
				require.Len(t, l.writes, 1)
			} else {
				require.Empty(t, l.writes)
			}
		})
	}
}
