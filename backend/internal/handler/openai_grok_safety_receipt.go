package handler

import (
	"net/http"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/apicompat"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

// A policy refusal, not a generated answer. Never echo the rejected prompt or
// provider diagnostics. Keep the code visible even to clients that strip headers.
const grokSafetyRefusal = "Request refused by Grok safety review (safety_review_rejected)."

func writeGrokSafetyReceipt(c *gin.Context, endpoint string, stream bool, mark *service.GrokSafetyReviewMark, r *service.UsageLog) {
	// Compact normalization may have removed stream:true after starting an SSE heartbeat.
	if service.StopOpenAICompactSSEKeepaliveCommitted(c) {
		stream = true
	}
	service.MarkResponseCommitted(c)
	if !c.Writer.Written() {
		c.Header("Cache-Control", "no-store")
		c.Header("X-Sub2API-Rejection-Code", mark.ErrorCode)
		c.Header("X-Sub2API-Billing-Request-Id", r.RequestID)
		if stream {
			c.Header("Content-Type", "text/event-stream")
			c.Header("X-Accel-Buffering", "no")
		}
	}
	c.Status(http.StatusOK)
	now := time.Now().Unix()
	totalInput := r.InputTokens + r.CacheReadTokens
	switch endpoint {
	case EndpointChatCompletions:
		id := "chatcmpl-" + mark.AttemptID
		usage := apicompat.ChatUsage{PromptTokens: totalInput, CompletionTokens: r.OutputTokens, TotalTokens: totalInput + r.OutputTokens,
			PromptTokensDetails: &apicompat.ChatTokenDetails{CachedTokens: r.CacheReadTokens}}
		if !stream {
			c.JSON(http.StatusOK, gin.H{"id": id, "object": "chat.completion", "model": r.Model, "created": now, "usage": usage,
				"choices": []gin.H{{"index": 0, "finish_reason": "content_filter", "message": gin.H{"role": "assistant", "content": nil, "refusal": grokSafetyRefusal}}}})
			return
		}
		chunk := apicompat.ChatCompletionsChunk{ID: id, Object: "chat.completion.chunk", Model: r.Model, Created: now}
		refusal, finish := grokSafetyRefusal, "content_filter"
		chunk.Choices = []apicompat.ChatChunkChoice{{Delta: apicompat.ChatDelta{Role: "assistant", Refusal: &refusal}}}
		c.SSEvent("", chunk)
		chunk.Choices = []apicompat.ChatChunkChoice{{FinishReason: &finish}}
		c.SSEvent("", chunk)
		chunk.Choices, chunk.Usage = []apicompat.ChatChunkChoice{}, &usage
		c.SSEvent("", chunk) // standard usage-only chunk, even if include_usage was omitted
		c.SSEvent("", "[DONE]")
	case EndpointMessages:
		msg := apicompat.AnthropicResponse{ID: "msg_" + mark.AttemptID, Type: "message", Role: "assistant", Model: r.Model,
			Usage:   apicompat.AnthropicUsage{InputTokens: r.InputTokens, CacheReadInputTokens: r.CacheReadTokens, OutputTokens: r.OutputTokens},
			Content: []apicompat.AnthropicContentBlock{{Type: "text", Text: grokSafetyRefusal}}, StopReason: apicompat.AnthropicStopReasonPtr("refusal")}
		if !stream {
			c.JSON(http.StatusOK, msg)
			return
		}
		msg.Content, msg.StopReason, msg.Usage.OutputTokens = []apicompat.AnthropicContentBlock{}, nil, 0
		event := func(kind string, data gin.H) { data["type"] = kind; c.SSEvent(kind, data) }
		event("message_start", gin.H{"message": msg})
		event("content_block_start", gin.H{"index": 0, "content_block": gin.H{"type": "text", "text": ""}})
		event("content_block_delta", gin.H{"index": 0, "delta": gin.H{"type": "text_delta", "text": grokSafetyRefusal}})
		event("content_block_stop", gin.H{"index": 0})
		event("message_delta", gin.H{"delta": gin.H{"stop_reason": "refusal", "stop_sequence": nil}, "usage": gin.H{"output_tokens": r.OutputTokens}})
		event("message_stop", gin.H{})
	default: // Responses
		part := apicompat.ResponsesContentPart{Type: "refusal", Refusal: grokSafetyRefusal}
		item := apicompat.ResponsesOutput{ID: "msg_" + mark.AttemptID, Type: "message", Role: "assistant", Status: "completed", Content: []apicompat.ResponsesContentPart{part}}
		resp := apicompat.ResponsesResponse{ID: "resp_" + mark.AttemptID, Object: "response", Model: r.Model, CreatedAt: now, Status: "completed", Output: []apicompat.ResponsesOutput{item},
			Usage: &apicompat.ResponsesUsage{InputTokens: totalInput, OutputTokens: r.OutputTokens, TotalTokens: totalInput + r.OutputTokens,
				InputTokensDetails: &apicompat.ResponsesInputTokensDetails{CachedTokens: r.CacheReadTokens}, OutputTokensDetails: &apicompat.ResponsesOutputTokensDetails{}}}
		if !stream {
			c.JSON(http.StatusOK, resp)
			return
		}
		seq := 0
		event := func(kind string, data gin.H) {
			data["type"], data["sequence_number"] = kind, seq
			seq++
			c.SSEvent(kind, data)
		}
		start := resp
		start.Status, start.Output, start.Usage = "in_progress", []apicompat.ResponsesOutput{}, nil
		event("response.created", gin.H{"response": start})
		added := item
		added.Status, added.Content = "in_progress", []apicompat.ResponsesContentPart{}
		event("response.output_item.added", gin.H{"output_index": 0, "item": added})
		partEvent := func(kind, key string, value any) {
			event(kind, gin.H{"item_id": item.ID, "output_index": 0, "content_index": 0, key: value})
		}
		partEvent("response.content_part.added", "part", gin.H{"type": "refusal", "refusal": ""})
		partEvent("response.refusal.delta", "delta", grokSafetyRefusal)
		partEvent("response.refusal.done", "refusal", grokSafetyRefusal)
		partEvent("response.content_part.done", "part", part)
		event("response.output_item.done", gin.H{"output_index": 0, "item": item})
		event("response.completed", gin.H{"response": resp})
	}
	c.Writer.Flush()
}
