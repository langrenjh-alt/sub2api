package service

import (
	"encoding/json"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/apicompat"
	"github.com/google/uuid"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// openAIResponsesDONEBridge repairs Responses-compatible upstreams that end a
// stream with the Chat Completions sentinel "[DONE]" but omit a Responses
// terminal event. Codex treats [DONE] as EOF, not as response.completed, and
// otherwise reports that the stream disconnected before completion.
type openAIResponsesDONEBridge struct {
	sawResponse    bool
	responseID     string
	responseModel  string
	outputItems    []json.RawMessage
	seenOutputItem map[string]struct{}
	errorCode      string
	errorMessage   string
}

func (b *openAIResponsesDONEBridge) HasResponse() bool {
	return b != nil && b.sawResponse
}

func (b *openAIResponsesDONEBridge) Observe(data []byte) {
	if b == nil || len(data) == 0 || !gjson.ValidBytes(data) {
		return
	}

	if response := gjson.GetBytes(data, "response"); response.IsObject() {
		b.sawResponse = true
		if id := strings.TrimSpace(response.Get("id").String()); id != "" {
			b.responseID = id
		}
		if model := strings.TrimSpace(response.Get("model").String()); model != "" {
			b.responseModel = model
		}
	}

	eventType := strings.TrimSpace(gjson.GetBytes(data, "type").String())
	if eventType == "error" {
		b.errorCode = strings.TrimSpace(gjson.GetBytes(data, "error.code").String())
		if b.errorCode == "" {
			b.errorCode = strings.TrimSpace(gjson.GetBytes(data, "error.type").String())
		}
		b.errorMessage = strings.TrimSpace(gjson.GetBytes(data, "error.message").String())
		if b.errorMessage == "" {
			b.errorMessage = strings.TrimSpace(gjson.GetBytes(data, "message").String())
		}
	}

	if eventType != "response.output_item.done" {
		return
	}
	item := gjson.GetBytes(data, "item")
	if !item.IsObject() {
		return
	}
	if b.seenOutputItem == nil {
		b.seenOutputItem = make(map[string]struct{})
	}
	key := strings.TrimSpace(item.Get("id").String())
	if key == "" {
		key = strings.TrimSpace(item.Get("call_id").String())
	}
	if key == "" {
		key = item.Raw
	}
	if _, exists := b.seenOutputItem[key]; exists {
		return
	}
	b.seenOutputItem[key] = struct{}{}
	b.outputItems = append(b.outputItems, json.RawMessage(append([]byte(nil), item.Raw...)))
}

func (b *openAIResponsesDONEBridge) TerminalEvent(
	responseID string,
	model string,
	acc *apicompat.BufferedResponseAccumulator,
	imageOutputs []json.RawMessage,
	usage *OpenAIUsage,
) ([]byte, error) {
	response := []byte(`{}`)
	if b != nil && strings.TrimSpace(b.responseID) != "" {
		responseID = b.responseID
	}

	responseID = strings.TrimSpace(responseID)
	if responseID == "" {
		responseID = "resp_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	}
	var err error
	response, err = sjson.SetBytes(response, "id", responseID)
	if err != nil {
		return nil, err
	}

	response, err = sjson.SetBytes(response, "object", "response")
	if err != nil {
		return nil, err
	}
	model = strings.TrimSpace(model)
	if model == "" && b != nil {
		model = strings.TrimSpace(b.responseModel)
	}
	if model != "" {
		response, err = sjson.SetBytes(response, "model", model)
		if err != nil {
			return nil, err
		}
	}
	terminalType := "response.completed"
	terminalStatus := "completed"
	if b != nil && b.errorMessage != "" {
		terminalType = "response.failed"
		terminalStatus = "failed"
	}
	response, err = sjson.SetBytes(response, "status", terminalStatus)
	if err != nil {
		return nil, err
	}
	response, _ = sjson.DeleteBytes(response, "incomplete_details")
	if terminalType == "response.failed" {
		code := strings.TrimSpace(b.errorCode)
		if code == "" {
			code = "upstream_error"
		}
		errorJSON, marshalErr := json.Marshal(map[string]string{
			"code":    code,
			"message": b.errorMessage,
		})
		if marshalErr != nil {
			return nil, marshalErr
		}
		response, err = sjson.SetRawBytes(response, "error", errorJSON)
		if err != nil {
			return nil, err
		}
	} else {
		response, _ = sjson.DeleteBytes(response, "error")
	}

	var outputJSON []byte
	if b != nil && len(b.outputItems) > 0 {
		outputJSON, err = json.Marshal(b.outputItems)
		if err != nil {
			return nil, err
		}
	} else if reconstructed, ok := buildResponsesOutputJSON(acc, imageOutputs); ok {
		outputJSON = reconstructed
	} else {
		outputJSON = []byte(`[]`)
	}
	response, err = sjson.SetRawBytes(response, "output", outputJSON)
	if err != nil {
		return nil, err
	}

	usageJSON := []byte(`{}`)
	if usage == nil {
		usage = &OpenAIUsage{}
	}
	usageJSON, err = sjson.SetBytes(usageJSON, "input_tokens", usage.InputTokens)
	if err != nil {
		return nil, err
	}
	usageJSON, err = sjson.SetBytes(usageJSON, "output_tokens", usage.OutputTokens)
	if err != nil {
		return nil, err
	}
	usageJSON, err = sjson.SetBytes(usageJSON, "total_tokens", usage.InputTokens+usage.OutputTokens)
	if err != nil {
		return nil, err
	}
	if usage.CacheReadInputTokens > 0 {
		usageJSON, err = sjson.SetBytes(usageJSON, "input_tokens_details.cached_tokens", usage.CacheReadInputTokens)
		if err != nil {
			return nil, err
		}
	}
	response, err = sjson.SetRawBytes(response, "usage", usageJSON)
	if err != nil {
		return nil, err
	}

	event := []byte(`{}`)
	event, err = sjson.SetBytes(event, "type", terminalType)
	if err != nil {
		return nil, err
	}
	event, err = sjson.SetRawBytes(event, "response", response)
	if err != nil {
		return nil, err
	}
	return event, nil
}
