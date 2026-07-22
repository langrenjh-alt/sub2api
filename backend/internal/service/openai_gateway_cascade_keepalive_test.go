package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestHandleChatStreamingResponse_KeepaliveSurvivesCascadeAndLargeRequest(t *testing.T) {
	recorder := newOpenAIResponseFlushRecorder()
	reader, writer := io.Pipe()
	stopSource, sourceDone := startCascadeCommentSource(writer, strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"ok"}`,
		``,
		`data: {"type":"response.completed","response":{"id":"resp_chat","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1}}}`,
		``,
	}, "\n"))
	t.Cleanup(func() {
		stopSource()
		_ = reader.Close()
		<-sourceDone
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	svc := &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{
		StreamKeepaliveInterval: 1,
	}}}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       reader,
	}

	resultCh := make(chan *OpenAIForwardResult, 1)
	errCh := make(chan error, 1)
	go func() {
		result, err := svc.handleChatStreamingResponse(
			resp, c, &Account{ID: 1, Platform: PlatformGrok},
			"grok-4.5", "grok-4.5", "grok-4.5", time.Now(),
			openAISilentRefusalMinRequestBodyBytes,
		)
		resultCh <- result
		errCh <- err
	}()

	waitOpenAIResponseFlushCount(t, recorder, 1)
	_, flushes := recorder.snapshot()
	require.Equal(t, ":\n\n", flushes[0], "upstream comments must not suppress the client-facing heartbeat")

	stopSource()
	require.NoError(t, <-errCh)
	require.NotNil(t, <-resultCh)
}

func TestHandleAnthropicStreamingResponse_KeepaliveSurvivesCascade(t *testing.T) {
	recorder := newOpenAIResponseFlushRecorder()
	reader, writer := io.Pipe()
	stopSource, sourceDone := startCascadeCommentSource(writer, strings.Join([]string{
		`data: {"type":"response.completed","response":{"id":"resp_messages","status":"completed","output":[{"type":"message","id":"msg_1","role":"assistant","status":"completed","content":[{"type":"output_text","text":"ok"}]}],"usage":{"input_tokens":1,"output_tokens":1}}}`,
		``,
	}, "\n"))
	t.Cleanup(func() {
		stopSource()
		_ = reader.Close()
		<-sourceDone
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	svc := &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{
		StreamKeepaliveInterval: 1,
	}}}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       reader,
	}

	resultCh := make(chan *OpenAIForwardResult, 1)
	errCh := make(chan error, 1)
	go func() {
		result, err := svc.handleAnthropicStreamingResponse(
			resp, c, &Account{ID: 1, Platform: PlatformGrok},
			"grok-4.5", "grok-4.5", "grok-4.5", time.Now(),
		)
		resultCh <- result
		errCh <- err
	}()

	waitOpenAIResponseFlushCount(t, recorder, 1)
	_, flushes := recorder.snapshot()
	require.Equal(t, "event: ping\ndata: {\"type\":\"ping\"}\n\n", flushes[0],
		"consumed upstream comments must not suppress the client-facing Anthropic ping")

	stopSource()
	require.NoError(t, <-errCh)
	require.NotNil(t, <-resultCh)
}

func TestStreamRawChatCompletions_LargeRequestForwardsUpstreamKeepalive(t *testing.T) {
	recorder := newOpenAIResponseFlushRecorder()
	reader, writer := io.Pipe()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	svc := &OpenAIGatewayService{cfg: &config.Config{}}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       reader,
	}

	resultCh := make(chan *OpenAIForwardResult, 1)
	errCh := make(chan error, 1)
	go func() {
		result, err := svc.streamRawChatCompletions(
			c, resp, &Account{ID: 1, Platform: PlatformOpenAI},
			"grok-4.5", "grok-4.5", "grok-4.5", nil, nil, time.Now(),
			openAISilentRefusalMinRequestBodyBytes,
		)
		resultCh <- result
		errCh <- err
	}()

	_, err := io.WriteString(writer, ": upstream keepalive\n\n")
	require.NoError(t, err)
	waitOpenAIResponseFlushCount(t, recorder, 1)
	_, flushes := recorder.snapshot()
	require.Equal(t, ": upstream keepalive\n\n", flushes[0])

	_, err = io.WriteString(writer, strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","model":"grok-4.5","choices":[{"index":0,"delta":{"content":"ok"}}]}`,
		``,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","model":"grok-4.5","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	require.NoError(t, <-errCh)
	require.NotNil(t, <-resultCh)
}

func TestOpenAISilentRefusalFailoverIsSafeAfterHeartbeat(t *testing.T) {
	err := newOpenAISilentRefusalFailoverError(nil, &Account{ID: 1, Platform: PlatformGrok}, "rid")
	require.True(t, err.SafeToFailoverAfterWrite)
}

func startCascadeCommentSource(writer *io.PipeWriter, terminal string) (func(), <-chan struct{}) {
	stop := make(chan struct{})
	done := make(chan struct{})
	var once sync.Once
	go func() {
		defer close(done)
		defer func() { _ = writer.Close() }()
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if _, err := io.WriteString(writer, ": upstream keepalive\n\n"); err != nil {
					return
				}
			case <-stop:
				_, _ = io.WriteString(writer, terminal)
				return
			}
		}
	}()
	return func() {
		once.Do(func() { close(stop) })
	}, done
}
