package service

import (
	"net/http"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/ctxkey"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tidwall/gjson"
)

// grokSafetyReviewRejectedCode 是 xAI 安全审查拒绝的官方错误码。
// 只有该码（或以 violation_fee.grok. 开头的 91 系计费码），或响应体里带
// SAFETY_CHECK_TYPE 标记时，才算"确认的安全拒绝"，才可能触发可配置扣费。
const grokSafetyReviewRejectedCode = "safety_review_rejected"

// grokViolationFeeCodePrefix 覆盖 xAI 的 91 计费类安全拒绝，例如
// {"status_code":403,"error_code":"violation_fee.grok.csam"}。
const grokViolationFeeCodePrefix = "violation_fee.grok."

// grokSafetyCheckMarker 是 xAI 在 message 末尾追加的安全检查标记
// （"... I'm sorry, I can't help with that request. Failed check: SAFETY_CHECK_TYPE"）。
const grokSafetyCheckMarker = "SAFETY_CHECK_TYPE"

// GrokSafetyReviewMark 记录一次已确认的上游 Grok 安全拒绝。
// 它与 CyberPolicyMark 刻意分离：只有分组/配置开启时才计费，且绝不从
// 一个裸 403、内容策略拒绝（new_sensitive）或账号额度拒绝推断出来。
type GrokSafetyReviewMark struct {
	AttemptID         string // 本次调用生成的幂等键（每次命中一条独立用量行）
	RequestID         string // 平台 X-Request-ID
	ClientRequestID   string // 平台 X-Client-Request-ID
	UpstreamRequestID string // 上游 X-Request-ID（如有）
	Model             string
	HTTPStatus        int
	ErrorCode         string
	Body              string
}

const grokSafetyReviewMarkKey = "ops_grok_safety_review"

// IsGrokSafetyReviewRejection 精确识别 xAI 的安全审查拒绝：结构化错误码
// （safety_review_rejected / violation_fee.grok.*），或 403/200 响应体里的
// SAFETY_CHECK_TYPE 标记。裸 403、"I'm sorry, I can't help" 之类的普通道歉、
// new_sensitive 内容策略码、账号额度码一律不算。
func IsGrokSafetyReviewRejection(statusCode int, body []byte) bool {
	if len(body) == 0 {
		return false
	}
	if grokSafetyReviewCodeFromPayload(body) != "" {
		return true
	}
	if statusCode != http.StatusForbidden && statusCode != http.StatusOK {
		return false
	}
	return strings.Contains(strings.ToUpper(string(body)), grokSafetyCheckMarker)
}

func grokSafetyReviewCodeFromPayload(body []byte) string {
	for _, path := range []string{
		"error.code",
		"response.error.code",
		"error_code",
		"error_type",
	} {
		code := strings.TrimSpace(gjson.GetBytes(body, path).String())
		if code != "" && isGrokSafetyReviewCode(code) {
			return code
		}
	}
	return ""
}

func isGrokSafetyReviewCode(code string) bool {
	normalized := strings.ToLower(strings.TrimSpace(code))
	return normalized == grokSafetyReviewRejectedCode ||
		strings.HasPrefix(normalized, grokViolationFeeCodePrefix)
}

// MarkGrokSafetyReview 只记录本次请求的第一条确认拒绝：SSE 里可能重复下发
// 多条错误帧，只有首个生效，因此同一次调用只会产生一条用量行。
func MarkGrokSafetyReview(c *gin.Context, mark GrokSafetyReviewMark) {
	if c == nil {
		return
	}
	if GetGrokSafetyReviewMark(c) != nil {
		return
	}
	if strings.TrimSpace(mark.AttemptID) == "" {
		mark.AttemptID = uuid.NewString()
	}
	mark.ErrorCode = strings.TrimSpace(mark.ErrorCode)
	if mark.ErrorCode == "" {
		mark.ErrorCode = grokSafetyReviewRejectedCode
	}
	mark.Body = truncateString(strings.TrimSpace(mark.Body), 4096)
	c.Set(grokSafetyReviewMarkKey, &mark)
}

// GetGrokSafetyReviewMark 返回安全拒绝标记，未命中或已 Clear 时返回 nil。
func GetGrokSafetyReviewMark(c *gin.Context) *GrokSafetyReviewMark {
	if c == nil {
		return nil
	}
	if v, ok := c.Get(grokSafetyReviewMarkKey); ok {
		if mark, ok := v.(*GrokSafetyReviewMark); ok {
			return mark
		}
	}
	return nil
}

// ClearGrokSafetyReviewMark 清除标记（WS 多轮在每个 turn 收尾时调用）。
func ClearGrokSafetyReviewMark(c *gin.Context) {
	if c == nil {
		return
	}
	c.Set(grokSafetyReviewMarkKey, (*GrokSafetyReviewMark)(nil))
}

// markGrokSafetyReviewFromUpstream 在确认命中时记录证据并返回 true。
// 它不会把裸 403 或普通内容策略拒绝当作安全拒绝。
func markGrokSafetyReviewFromUpstream(c *gin.Context, upstreamRequestID, model string, status int, body []byte) bool {
	if c == nil || !IsGrokSafetyReviewRejection(status, body) {
		return false
	}
	mark := GrokSafetyReviewMark{
		RequestID:         strings.TrimSpace(c.Writer.Header().Get("X-Request-ID")),
		UpstreamRequestID: strings.TrimSpace(upstreamRequestID),
		Model:             strings.TrimSpace(model),
		HTTPStatus:        status,
		ErrorCode:         grokSafetyReviewRejectedCode,
		Body:              string(body),
	}
	if c.Request != nil {
		mark.ClientRequestID, _ = c.Request.Context().Value(ctxkey.ClientRequestID).(string)
	}
	MarkGrokSafetyReview(c, mark)
	return true
}

// grokSafetyReviewStatus 返回面向客户端的 HTTP 状态：流式拒绝发生在 200 之后，
// 保持 200；非流式 403 原样返回。
func grokSafetyReviewStatus(stream bool, upstreamStatus int) int {
	if stream {
		return http.StatusOK
	}
	if upstreamStatus == http.StatusForbidden {
		return http.StatusForbidden
	}
	return upstreamStatus
}

// grokSafetyReviewErrorCode 返回给下游错误体里的 code 字段（仅在确认拒绝时附带）。
func grokSafetyReviewErrorCode(marked bool) string {
	if marked {
		return grokSafetyReviewRejectedCode
	}
	return ""
}
