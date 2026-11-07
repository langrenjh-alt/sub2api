package handler

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/ip"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// grokSafetyBillingRecordedKey 防止同一逻辑请求重复计费：
// 非流式 403 与流式错误帧可能在同一 gin context 上多次写入标记，
// 而扣费只允许发生一次。
const grokSafetyBillingRecordedKey = "ops_grok_safety_billing_recorded"

// recordGrokSafetyBillingIfMarked 在 gateway Forward 返回后检查 Grok 安全审查标记。
//
// 只有结构化安全拒绝（safety_review_rejected / violation_fee.grok.* /
// SAFETY_CHECK_TYPE）才会留下标记，因此普通 403、内容策略拒绝、账号额度拒绝都不会扣费。
// 命中且配置开启时，异步写一条按官方价卡合成的 token 用量行（输入/输出随机、
// 缓存读取 >=90%），金额命中 gateway.grok.safety_rejection_billing.amount_usd。
func (h *OpenAIGatewayHandler) recordGrokSafetyBillingIfMarked(
	c *gin.Context,
	apiKey *service.APIKey,
	account *service.Account,
	subscription *service.UserSubscription,
	model string,
	channelFields service.ChannelUsageFields,
	requestPayloadHash string,
) {
	if h == nil || h.gatewayService == nil {
		return
	}
	mark := service.GetGrokSafetyReviewMark(c)
	if mark == nil || apiKey == nil || account == nil {
		return
	}
	if account.Platform != service.PlatformGrok {
		return
	}
	if c.GetBool(grokSafetyBillingRecordedKey) {
		return
	}
	if !h.gatewayService.GrokSafetyRejectionBillingEnabled(c.Request.Context()) {
		return
	}
	requestID := strings.TrimSpace(mark.AttemptID)
	if requestID == "" {
		requestID = strings.TrimSpace(c.Writer.Header().Get("X-Request-ID"))
	}
	if requestID == "" {
		return
	}
	c.Set(grokSafetyBillingRecordedKey, true)

	if billingModel := strings.TrimSpace(model); billingModel == "" {
		model = mark.Model
	} else {
		model = billingModel
	}
	stream := mark.HTTPStatus == http.StatusOK
	inboundEndpoint := GetInboundEndpoint(c)
	upstreamEndpoint := resolveOpenAIUpstreamEndpoint(c, account, nil)
	userAgent := c.GetHeader("User-Agent")
	clientIP := strings.TrimSpace(ip.GetClientIP(c))
	sessionID := service.ExtractClientSessionID(c)
	pricingAt := time.Now()
	apiKeySvc := h.apiKeyService
	gwSvc := h.gatewayService

	h.submitMandatoryUsageRecordTask(c.Request.Context(), func(ctx context.Context) {
		gwSvc.RecordGrokSafetyRejectionUsage(ctx, service.GrokSafetyRejectionBillingInput{
			APIKey:             apiKey,
			Account:            account,
			Subscription:       subscription,
			Model:              model,
			Stream:             stream,
			RequestID:          requestID,
			InboundEndpoint:    inboundEndpoint,
			UpstreamEndpoint:   upstreamEndpoint,
			UserAgent:          userAgent,
			IPAddress:          clientIP,
			SessionID:          sessionID,
			RequestPayloadHash: requestPayloadHash,
			APIKeyService:      apiKeySvc,
			ChannelUsageFields: channelFields,
			PricingAt:          pricingAt,
		})
	})

	logger.L().With(
		zap.String("component", "handler.openai_gateway.grok_safety"),
		zap.String("request_id", requestID),
		zap.String("model", model),
		zap.Int64("api_key_id", apiKey.ID),
		zap.Int64("account_id", account.ID),
		zap.String("error_code", mark.ErrorCode),
		zap.Bool("stream", stream),
	).Info("grok_safety_rejection.billing_queued")
}
