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

// Direct upstream HTTP 403s can still be answered on the original request.
// Settle synchronously only on this rare path: an unpriced or unpaid refusal
// must not advertise chargeable usage. The guard also prevents the post-forward
// SSE/WS recorder from submitting the same fee a second time.
func (h *OpenAIGatewayHandler) bindGrokSafetyHTTPBilling(c *gin.Context, apiKey *service.APIKey,
	subscription *service.UserSubscription, model, endpoint string, stream bool,
	fields service.ChannelUsageFields, payloadHash string, pricingAt time.Time,
) {
	service.BindGrokSafetyHTTPResponder(c, func(account *service.Account, mark *service.GrokSafetyReviewMark) bool {
		if c.GetBool(grokSafetyBillingRecordedKey) {
			return false
		}
		c.Set(grokSafetyBillingRecordedKey, true)
		in := h.grokSafetyBillingInput(c, apiKey, account, subscription, model, mark.AttemptID, stream,
			fields, payloadHash, pricingAt)
		// A client disconnect must not cancel settlement of a confirmed upstream fee.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(c.Request.Context()), 10*time.Second)
		defer cancel()
		receipt := h.gatewayService.RecordGrokSafetyRejectionUsage(ctx, in)
		if receipt == nil {
			return false
		}
		writeGrokSafetyReceipt(c, endpoint, stream, mark, receipt)
		return true
	})
}

func (h *OpenAIGatewayHandler) grokSafetyBillingInput(c *gin.Context, apiKey *service.APIKey,
	account *service.Account, subscription *service.UserSubscription, model, requestID string,
	stream bool, fields service.ChannelUsageFields, payloadHash string, pricingAt time.Time,
) service.GrokSafetyRejectionBillingInput {
	return service.GrokSafetyRejectionBillingInput{
		APIKey: apiKey, Account: account, Subscription: subscription, Model: model, Stream: stream,
		RequestID: requestID, InboundEndpoint: GetInboundEndpoint(c), UpstreamEndpoint: resolveOpenAIUpstreamEndpoint(c, account, nil),
		UserAgent: c.GetHeader("User-Agent"), IPAddress: strings.TrimSpace(ip.GetClientIP(c)),
		SessionID: service.ExtractClientSessionID(c), RequestPayloadHash: payloadHash, APIKeyService: h.apiKeyService,
		ChannelUsageFields: fields, PricingAt: pricingAt,
	}
}

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
	in := h.grokSafetyBillingInput(c, apiKey, account, subscription, model, requestID, stream,
		channelFields, requestPayloadHash, time.Now())
	gwSvc := h.gatewayService

	h.submitMandatoryUsageRecordTask(c.Request.Context(), func(ctx context.Context) {
		gwSvc.RecordGrokSafetyRejectionUsage(ctx, in)
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
