//go:build unit

package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// 只有 xAI 官方的结构化安全拒绝才算"可计费的安全拒绝"：
// safety_review_rejected、violation_fee.grok.*、或显式 SAFETY_CHECK_TYPE 标记。
// 裸 403、内容策略码、账号额度码都必须被排除，否则会把所有 403 都扣费。
func TestIsGrokSafetyReviewRejection(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
		want   bool
	}{
		{
			name:   "documented error code",
			status: http.StatusForbidden,
			body:   `{"error":{"code":"safety_review_rejected","type":"invalid_request_error","message":"I'm sorry, I can't help with that request."}}`,
			want:   true,
		},
		{
			name:   "nested response error code",
			status: http.StatusForbidden,
			body:   `{"type":"response.failed","response":{"error":{"code":"safety_review_rejected"}}}`,
			want:   true,
		},
		{
			name:   "91 top-level violation fee code",
			status: http.StatusForbidden,
			body:   `{"status_code":403,"error_code":"violation_fee.grok.csam","error_type":"openai_error"}`,
			want:   true,
		},
		{
			name:   "91 violation fee code with marker",
			status: http.StatusForbidden,
			body:   `{"error":{"code":"violation_fee.grok.csam","message":"I'm sorry, I can't help with that request. Failed check: SAFETY_CHECK_TYPE"}}`,
			want:   true,
		},
		{
			name:   "91 marker-only 403",
			status: http.StatusForbidden,
			body:   `{"error":{"type":"invalid_request_error","message":"I'm sorry, I can't help with that request. Failed check: SAFETY_CHECK_TYPE"}}`,
			want:   true,
		},
		{
			name:   "bare forbidden is not enough",
			status: http.StatusForbidden,
			body:   `{"error":{"type":"invalid_request_error","message":"I'm sorry, I can't help with that request."}}`,
			want:   false,
		},
		{
			name:   "old content policy code is not this fee",
			status: http.StatusForbidden,
			body:   `{"error":{"code":"new_sensitive","message":"text is sensitive"}}`,
			want:   false,
		},
		{
			name:   "account entitlement is not this fee",
			status: http.StatusForbidden,
			body:   `{"error":{"code":"subscription_required","message":"subscription required"}}`,
			want:   false,
		},
		{
			name:   "marker outside 403/200 is ignored",
			status: http.StatusBadRequest,
			body:   `{"error":{"message":"Failed check: SAFETY_CHECK_TYPE"}}`,
			want:   false,
		},
		{
			name:   "stream frame with safety code",
			status: http.StatusOK,
			body:   `{"type":"response.failed","response":{"error":{"code":"violation_fee.grok.csam","message":"blocked"}}}`,
			want:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsGrokSafetyReviewRejection(tt.status, []byte(tt.body)))
		})
	}
}

func TestGrokSafetyReviewMarkIsFirstWins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	first := GrokSafetyReviewMark{AttemptID: "attempt-1", RequestID: "req-1", ErrorCode: grokSafetyReviewRejectedCode}
	second := GrokSafetyReviewMark{AttemptID: "attempt-2", RequestID: "req-2", ErrorCode: grokSafetyReviewRejectedCode}

	MarkGrokSafetyReview(c, first)
	MarkGrokSafetyReview(c, second)
	got := GetGrokSafetyReviewMark(c)
	require.NotNil(t, got)
	require.Equal(t, "attempt-1", got.AttemptID)
	require.Equal(t, "req-1", got.RequestID)

	ClearGrokSafetyReviewMark(c)
	require.Nil(t, GetGrokSafetyReviewMark(c))
}

// 安全拒绝是请求级失败：切换账号不会改变结果，因此不得 failover。
func TestShouldFailoverGrokUpstreamError_SafetyRejectionDoesNotFailover(t *testing.T) {
	svc := &OpenAIGatewayService{}
	body := []byte(`{"error":{"code":"violation_fee.grok.csam","message":"blocked"}}`)
	require.False(t, svc.shouldFailoverGrokUpstreamError(http.StatusForbidden, body))
}

// handleErrorResponse：确认的安全拒绝要打标并以 403 + code 返回；普通 403 不打标。
func TestHandleErrorResponse_MarksOnlyConfirmedGrokSafetyRejection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := &OpenAIGatewayService{accountRepo: &grokQuotaAccountRepo{}}
	account := &Account{ID: 6111, Platform: PlatformGrok, Type: AccountTypeOAuth}

	newContext := func() (*gin.Context, *httptest.ResponseRecorder) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
		return c, recorder
	}
	respond := func(c *gin.Context, body string) int {
		resp := &http.Response{
			StatusCode: http.StatusForbidden,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(body)),
		}
		_, err := svc.handleErrorResponse(context.Background(), resp, c, account, nil, "grok-4.6")
		require.Error(t, err)
		return c.Writer.Status()
	}

	safetyBody := `{"status_code":403,"error_code":"violation_fee.grok.csam","error_type":"openai_error"}`
	c, recorder := newContext()
	status := respond(c, safetyBody)
	require.Equal(t, http.StatusForbidden, status)
	mark := GetGrokSafetyReviewMark(c)
	require.NotNil(t, mark, "confirmed safety rejection must be marked for billing")
	require.Equal(t, grokSafetyReviewRejectedCode, mark.ErrorCode)
	require.Contains(t, recorder.Body.String(), grokSafetyReviewRejectedCode)

	plain, _ := newContext()
	respond(plain, `{"error":{"type":"invalid_request_error","message":"I'm sorry, I can't help with that request."}}`)
	require.Nil(t, GetGrokSafetyReviewMark(plain), "a bare 403 must never be billed")

	contentPolicy, _ := newContext()
	respond(contentPolicy, `{"error":{"code":"new_sensitive","message":"text is sensitive"}}`)
	require.Nil(t, GetGrokSafetyReviewMark(contentPolicy), "legacy content policy codes are not the safety fee")
}
