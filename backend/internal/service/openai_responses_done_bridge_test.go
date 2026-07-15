package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func responsesDONEOnlyUpstreamBody() string {
	return strings.Join([]string{
		`event: response.created`,
		`data: {"type":"response.created","response":{"id":"resp_done_bridge","object":"response","model":"gpt-5","status":"in_progress","output":[]}}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"hello"}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
}

func collectResponsesEventPayloads(body string) []gjson.Result {
	var events []gjson.Result
	forEachOpenAISSEDataPayload(body, func(data []byte) {
		if gjson.ValidBytes(data) {
			events = append(events, gjson.ParseBytes(data))
		}
	})
	return events
}

func TestOpenAIResponsesDONEBridge_NonPassthroughSynthesizesCompleted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	svc := &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{MaxLineSize: defaultMaxLineSize}}}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(responsesDONEOnlyUpstreamBody())),
	}

	result, err := svc.handleStreamingResponse(
		c.Request.Context(), resp, c, &Account{ID: 1}, time.Now(), "gpt-5", "gpt-5",
	)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, "resp_done_bridge", result.responseID)
	require.NotContains(t, recorder.Body.String(), "data: [DONE]")

	events := collectResponsesEventPayloads(recorder.Body.String())
	require.NotEmpty(t, events)
	terminal := events[len(events)-1]
	require.Equal(t, "response.completed", terminal.Get("type").String())
	require.Equal(t, "resp_done_bridge", terminal.Get("response.id").String())
	require.Equal(t, "completed", terminal.Get("response.status").String())
	require.Equal(t, "hello", terminal.Get("response.output.0.content.0.text").String())
	require.True(t, terminal.Get("response.usage.total_tokens").Exists())
}

func TestOpenAIResponsesDONEBridge_PassthroughSynthesizesCompleted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	svc := &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{MaxLineSize: defaultMaxLineSize}}}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(responsesDONEOnlyUpstreamBody())),
	}

	result, err := svc.handleStreamingResponsePassthrough(
		c.Request.Context(), resp, c, &Account{ID: 1}, time.Now(), "gpt-5", "gpt-5",
	)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, "resp_done_bridge", result.responseID)
	require.NotContains(t, recorder.Body.String(), "data: [DONE]")

	events := collectResponsesEventPayloads(recorder.Body.String())
	require.NotEmpty(t, events)
	terminal := events[len(events)-1]
	require.Equal(t, "response.completed", terminal.Get("type").String())
	require.Equal(t, "hello", terminal.Get("response.output.0.content.0.text").String())
}

func TestOpenAIResponsesDONEBridge_DoesNotDuplicateRealTerminal(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_real_terminal","object":"response","model":"gpt-5","status":"in_progress","output":[]}}`,
		``,
		`data: {"type":"response.completed","response":{"id":"resp_real_terminal","object":"response","model":"gpt-5","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	svc := &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{MaxLineSize: defaultMaxLineSize}}}
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}

	_, err := svc.handleStreamingResponse(c.Request.Context(), resp, c, &Account{ID: 1}, time.Now(), "gpt-5", "gpt-5")
	require.NoError(t, err)
	require.Contains(t, recorder.Body.String(), "data: [DONE]")
	require.Equal(t, 1, strings.Count(recorder.Body.String(), `"type":"response.completed"`))
}

func TestOpenAIResponsesDONEBridge_ErrorBeforeDONEBecomesFailed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_done_error","object":"response","model":"gpt-5","status":"in_progress","output":[]}}`,
		``,
		`data: {"type":"error","error":{"code":"upstream_error","message":"upstream stopped"}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	svc := &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{MaxLineSize: defaultMaxLineSize}}}
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}

	_, err := svc.handleStreamingResponse(c.Request.Context(), resp, c, &Account{ID: 1}, time.Now(), "gpt-5", "gpt-5")
	require.ErrorContains(t, err, "upstream response failed")
	require.NotContains(t, recorder.Body.String(), "data: [DONE]")

	events := collectResponsesEventPayloads(recorder.Body.String())
	require.NotEmpty(t, events)
	terminal := events[len(events)-1]
	require.Equal(t, "response.failed", terminal.Get("type").String())
	require.Equal(t, "failed", terminal.Get("response.status").String())
	require.Equal(t, "upstream stopped", terminal.Get("response.error.message").String())
}
