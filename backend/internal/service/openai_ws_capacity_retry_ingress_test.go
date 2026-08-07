package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	coderws "github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestOpenAIGatewayService_ProxyResponsesWebSocketFromClient_CtxPoolCapacityFailureIsNotForwarded(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := newOpenAIWSV2TestConfig()
	cfg.Security.URLAllowlist.Enabled = false
	cfg.Security.URLAllowlist.AllowInsecureHTTP = true
	cfg.Gateway.OpenAIWS.MinIdlePerAccount = 0
	cfg.Gateway.OpenAIWS.DialTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.ReadTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.WriteTimeoutSeconds = 3

	upstreamConn := &openAIWSCaptureConn{events: [][]byte{
		[]byte(`{"type":"response.created","response":{"id":"resp_capacity_ctx_pool","model":"gpt-5.1"}}`),
		[]byte(`{"type":"response.in_progress","response":{"id":"resp_capacity_ctx_pool","model":"gpt-5.1"}}`),
		[]byte(`{"type":"response.output_item.added","output_index":0,"item":{"type":"message","role":"assistant","content":[]}}`),
		[]byte(`{"type":"response.content_part.added","output_index":0,"content_index":0,"part":{"type":"output_text","text":""}}`),
		[]byte(`{"type":"response.failed","response":{"id":"resp_capacity_ctx_pool","model":"gpt-5.1","error":{"type":"invalid_request_error","message":"Selected model is at capacity. Please try a different model."}}}`),
	}}
	dialer := &openAIWSCaptureDialer{conn: upstreamConn}
	pool := newOpenAIWSConnPool(cfg)
	pool.setClientDialerForTest(dialer)
	svc := &OpenAIGatewayService{
		cfg:              cfg,
		httpUpstream:     &httpUpstreamRecorder{},
		cache:            &stubGatewayCache{},
		openaiWSResolver: NewOpenAIWSProtocolResolver(cfg),
		toolCorrector:    NewCodexToolCorrector(),
		openaiWSPool:     pool,
	}
	account := &Account{
		ID:          1401,
		Name:        "openai-ingress-capacity-ctx-pool",
		Platform:    PlatformOpenAI,
		Type:        AccountTypeAPIKey,
		Status:      StatusActive,
		Schedulable: true,
		Concurrency: 1,
		Credentials: map[string]any{"api_key": "sk-test"},
		Extra:       map[string]any{"responses_websockets_v2_enabled": true},
	}

	serverErr := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := coderws.Accept(w, r, &coderws.AcceptOptions{CompressionMode: coderws.CompressionContextTakeover})
		if err != nil {
			serverErr <- err
			return
		}
		defer func() { _ = conn.CloseNow() }()

		readCtx, cancelRead := context.WithTimeout(r.Context(), 3*time.Second)
		msgType, firstMessage, readErr := conn.Read(readCtx)
		cancelRead()
		if readErr != nil {
			serverErr <- readErr
			return
		}
		if msgType != coderws.MessageText {
			serverErr <- errors.New("first message was not text")
			return
		}
		recorder := httptest.NewRecorder()
		ginCtx, _ := gin.CreateTestContext(recorder)
		ginCtx.Request = r.Clone(r.Context())
		serverErr <- svc.ProxyResponsesWebSocketFromClient(r.Context(), ginCtx, conn, account, "sk-test", firstMessage, nil)
	}))
	defer server.Close()

	dialCtx, cancelDial := context.WithTimeout(context.Background(), 3*time.Second)
	clientConn, _, err := coderws.Dial(dialCtx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
	cancelDial()
	require.NoError(t, err)
	defer func() { _ = clientConn.CloseNow() }()

	writeCtx, cancelWrite := context.WithTimeout(context.Background(), 3*time.Second)
	err = clientConn.Write(writeCtx, coderws.MessageText, []byte(`{"type":"response.create","model":"gpt-5.1","stream":false}`))
	cancelWrite()
	require.NoError(t, err)

	select {
	case relayErr := <-serverErr:
		require.Error(t, relayErr)
		var failoverErr *UpstreamFailoverError
		require.ErrorAs(t, relayErr, &failoverErr)
		require.True(t, failoverErr.IsOpenAIModelCapacity())
	case <-time.After(5 * time.Second):
		t.Fatal("ctx_pool capacity failover did not return")
	}

	readCtx, cancelRead := context.WithTimeout(context.Background(), 3*time.Second)
	_, payload, readErr := clientConn.Read(readCtx)
	cancelRead()
	require.Error(t, readErr)
	require.NotContains(t, string(payload), "Selected model is at capacity")
	require.Equal(t, 1, dialer.DialCount())
}

func TestOpenAIGatewayService_ProxyResponsesWebSocketFromClient_ForwardsErrorBeforeUpstreamClose(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := newOpenAIWSV2TestConfig()
	cfg.Security.URLAllowlist.Enabled = false
	cfg.Security.URLAllowlist.AllowInsecureHTTP = true
	cfg.Gateway.OpenAIWS.MinIdlePerAccount = 0
	cfg.Gateway.OpenAIWS.DialTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.ReadTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.WriteTimeoutSeconds = 3

	upstreamConn := &openAIWSCaptureConn{events: [][]byte{
		[]byte(`{"type":"error","error":{"type":"invalid_request_error","message":"request was rejected"}}`),
	}}
	dialer := &openAIWSCaptureDialer{conn: upstreamConn}
	pool := newOpenAIWSConnPool(cfg)
	pool.setClientDialerForTest(dialer)
	svc := &OpenAIGatewayService{
		cfg:              cfg,
		httpUpstream:     &httpUpstreamRecorder{},
		cache:            &stubGatewayCache{},
		openaiWSResolver: NewOpenAIWSProtocolResolver(cfg),
		toolCorrector:    NewCodexToolCorrector(),
		openaiWSPool:     pool,
	}
	account := &Account{
		ID:          1403,
		Name:        "openai-ingress-error-close",
		Platform:    PlatformOpenAI,
		Type:        AccountTypeAPIKey,
		Status:      StatusActive,
		Schedulable: true,
		Concurrency: 1,
		Credentials: map[string]any{"api_key": "sk-test"},
		Extra:       map[string]any{"responses_websockets_v2_enabled": true},
	}

	serverErr := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := coderws.Accept(w, r, &coderws.AcceptOptions{CompressionMode: coderws.CompressionContextTakeover})
		if err != nil {
			serverErr <- err
			return
		}
		defer func() { _ = conn.CloseNow() }()
		readCtx, cancelRead := context.WithTimeout(r.Context(), 3*time.Second)
		msgType, firstMessage, readErr := conn.Read(readCtx)
		cancelRead()
		if readErr != nil {
			serverErr <- readErr
			return
		}
		if msgType != coderws.MessageText {
			serverErr <- errors.New("first message was not text")
			return
		}
		recorder := httptest.NewRecorder()
		ginCtx, _ := gin.CreateTestContext(recorder)
		ginCtx.Request = r.Clone(r.Context())
		serverErr <- svc.ProxyResponsesWebSocketFromClient(r.Context(), ginCtx, conn, account, "sk-test", firstMessage, nil)
	}))
	defer server.Close()
	dialCtx, cancelDial := context.WithTimeout(context.Background(), 3*time.Second)
	clientConn, _, err := coderws.Dial(dialCtx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
	cancelDial()
	require.NoError(t, err)
	defer func() { _ = clientConn.CloseNow() }()
	writeCtx, cancelWrite := context.WithTimeout(context.Background(), 3*time.Second)
	err = clientConn.Write(writeCtx, coderws.MessageText, []byte(`{"type":"response.create","model":"gpt-5.1","stream":false}`))
	cancelWrite()
	require.NoError(t, err)

	readCtx, cancelRead := context.WithTimeout(context.Background(), 2*time.Second)
	_, payload, err := clientConn.Read(readCtx)
	cancelRead()
	require.NoError(t, err)
	require.Equal(t, "error", gjson.GetBytes(payload, "type").String())
	require.Contains(t, string(payload), "request was rejected")

	select {
	case relayErr := <-serverErr:
		require.Error(t, relayErr)
	case <-time.After(3 * time.Second):
		t.Fatal("upstream EOF did not finish the relay")
	}
}

func TestOpenAIGatewayService_ProxyResponsesWebSocketFromClient_CtxPoolLaterTurnCapacityDoesNotReplayFirstTurn(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := newOpenAIWSV2TestConfig()
	cfg.Security.URLAllowlist.Enabled = false
	cfg.Security.URLAllowlist.AllowInsecureHTTP = true
	cfg.Gateway.OpenAIWS.MinIdlePerAccount = 0
	cfg.Gateway.OpenAIWS.DialTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.ReadTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.WriteTimeoutSeconds = 3

	upstreamConn := &openAIWSCaptureConn{events: [][]byte{
		[]byte(`{"type":"response.completed","response":{"id":"resp_ctx_pool_first","model":"gpt-5.1","usage":{"input_tokens":1,"output_tokens":1}}}`),
		[]byte(`{"type":"response.created","response":{"id":"resp_ctx_pool_second","model":"gpt-5.1"}}`),
		[]byte(`{"type":"response.in_progress","response":{"id":"resp_ctx_pool_second","model":"gpt-5.1"}}`),
		[]byte(`{"type":"response.failed","response":{"id":"resp_ctx_pool_second","model":"gpt-5.1","error":{"type":"invalid_request_error","message":"Selected model is at capacity. Please try a different model."}}}`),
	}}
	dialer := &openAIWSCaptureDialer{conn: upstreamConn}
	pool := newOpenAIWSConnPool(cfg)
	pool.setClientDialerForTest(dialer)
	svc := &OpenAIGatewayService{
		cfg:              cfg,
		httpUpstream:     &httpUpstreamRecorder{},
		cache:            &stubGatewayCache{},
		openaiWSResolver: NewOpenAIWSProtocolResolver(cfg),
		toolCorrector:    NewCodexToolCorrector(),
		openaiWSPool:     pool,
	}
	account := &Account{
		ID:          1402,
		Name:        "openai-ingress-capacity-later-turn",
		Platform:    PlatformOpenAI,
		Type:        AccountTypeAPIKey,
		Status:      StatusActive,
		Schedulable: true,
		Concurrency: 1,
		Credentials: map[string]any{"api_key": "sk-test"},
		Extra:       map[string]any{"responses_websockets_v2_enabled": true},
	}

	serverErr := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := coderws.Accept(w, r, &coderws.AcceptOptions{CompressionMode: coderws.CompressionContextTakeover})
		if err != nil {
			serverErr <- err
			return
		}
		defer func() { _ = conn.CloseNow() }()
		readCtx, cancelRead := context.WithTimeout(r.Context(), 3*time.Second)
		msgType, firstMessage, readErr := conn.Read(readCtx)
		cancelRead()
		if readErr != nil {
			serverErr <- readErr
			return
		}
		if msgType != coderws.MessageText {
			serverErr <- errors.New("first message was not text")
			return
		}
		recorder := httptest.NewRecorder()
		ginCtx, _ := gin.CreateTestContext(recorder)
		ginCtx.Request = r.Clone(r.Context())
		serverErr <- svc.ProxyResponsesWebSocketFromClient(r.Context(), ginCtx, conn, account, "sk-test", firstMessage, nil)
	}))
	defer server.Close()

	dialCtx, cancelDial := context.WithTimeout(context.Background(), 3*time.Second)
	clientConn, _, err := coderws.Dial(dialCtx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
	cancelDial()
	require.NoError(t, err)
	defer func() { _ = clientConn.CloseNow() }()

	write := func(payload string) {
		writeCtx, cancelWrite := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelWrite()
		require.NoError(t, clientConn.Write(writeCtx, coderws.MessageText, []byte(payload)))
	}
	read := func() ([]byte, error) {
		readCtx, cancelRead := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelRead()
		_, payload, readErr := clientConn.Read(readCtx)
		return payload, readErr
	}

	write(`{"type":"response.create","model":"gpt-5.1","stream":false}`)
	firstResponse, readErr := read()
	require.NoError(t, readErr)
	require.Equal(t, "response.completed", gjson.GetBytes(firstResponse, "type").String())

	write(`{"type":"response.create","model":"gpt-5.1","stream":false,"previous_response_id":"resp_ctx_pool_first"}`)
	select {
	case relayErr := <-serverErr:
		require.Error(t, relayErr)
		var closeErr *OpenAIWSClientCloseError
		require.ErrorAs(t, relayErr, &closeErr)
		require.Equal(t, coderws.StatusTryAgainLater, closeErr.StatusCode())
		require.NotContains(t, relayErr.Error(), "Selected model is at capacity")
	case <-time.After(5 * time.Second):
		t.Fatal("later-turn capacity close did not return")
	}

	_, _, readErr = func() (coderws.MessageType, []byte, error) {
		readCtx, cancelRead := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelRead()
		return clientConn.Read(readCtx)
	}()
	require.Error(t, readErr)
	upstreamConn.mu.Lock()
	writes := append([]map[string]any(nil), upstreamConn.writes...)
	upstreamConn.mu.Unlock()
	require.Len(t, writes, 2, "the second turn must be sent once; the first turn must not be replayed")
	require.Equal(t, "response.create", writes[0]["type"])
	require.Equal(t, "response.create", writes[1]["type"])
	require.Equal(t, 1, dialer.DialCount())
}

func TestOpenAIGatewayService_ProxyResponsesWebSocketFromClient_PassthroughCapacityFailureIsNotForwarded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	controlCtx := context.Background()
	upstream := newStagedPassthroughConn()
	upstream.Send(`{"type":"response.created","response":{"id":"resp_capacity_passthrough","model":"gpt-5.1"}}`)
	upstream.Send(`{"type":"response.in_progress","response":{"id":"resp_capacity_passthrough","model":"gpt-5.1"}}`)
	upstream.Send(`{"type":"response.failed","response":{"id":"resp_capacity_passthrough","model":"gpt-5.1","error":{"type":"invalid_request_error","message":"Selected model is at capacity. Please try a different model."}}}`)

	server, serverErr := startPassthroughLifecycleServer(
		t,
		controlCtx,
		newPassthroughLifecycleService(passthroughLifecycleConfig(), upstream),
		passthroughLifecycleAccount(),
	)
	defer server.Close()
	clientConn := dialPassthroughLifecycleClient(t, server)
	defer func() { _ = clientConn.CloseNow() }()

	created, err := readPassthroughLifecycleFrame(t, clientConn, 3*time.Second)
	require.NoError(t, err)
	require.Equal(t, "response.created", gjson.GetBytes(created, "type").String())
	inProgress, err := readPassthroughLifecycleFrame(t, clientConn, 3*time.Second)
	require.NoError(t, err)
	require.Equal(t, "response.in_progress", gjson.GetBytes(inProgress, "type").String())

	_, payload, readErr := func() (coderws.MessageType, []byte, error) {
		readCtx, cancelRead := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelRead()
		return clientConn.Read(readCtx)
	}()
	require.Error(t, readErr)
	require.NotContains(t, string(payload), "Selected model is at capacity")

	select {
	case relayErr := <-serverErr:
		require.Error(t, relayErr)
		var closeErr *OpenAIWSClientCloseError
		require.ErrorAs(t, relayErr, &closeErr)
		require.Equal(t, coderws.StatusTryAgainLater, closeErr.StatusCode())
		require.Equal(t, openAIWSCapacityRetryCloseReason, closeErr.Reason())
		require.NotContains(t, relayErr.Error(), "Selected model is at capacity")
	case <-time.After(5 * time.Second):
		t.Fatal("passthrough capacity failover did not return")
	}

	require.Equal(t, `{"type":"response.create","model":"gpt-5.1","stream":false}`, string(requirePassthroughUpstreamWrite(t, upstream, 3*time.Second)))
}

func TestOpenAIGatewayService_ProxyResponsesWebSocketFromClient_PassthroughCapacityFailureBeforeOutputReturnsFailover(t *testing.T) {
	gin.SetMode(gin.TestMode)
	upstream := newStagedPassthroughConn()
	upstream.Send(`{"type":"response.failed","response":{"id":"resp_capacity_passthrough_first","model":"gpt-5.1","error":{"type":"invalid_request_error","message":"Selected model is at capacity. Please try a different model."}}}`)

	server, serverErr := startPassthroughLifecycleServer(
		t,
		context.Background(),
		newPassthroughLifecycleService(passthroughLifecycleConfig(), upstream),
		passthroughLifecycleAccount(),
	)
	defer server.Close()
	clientConn := dialPassthroughLifecycleClient(t, server)
	defer func() { _ = clientConn.CloseNow() }()

	_, payload, readErr := func() (coderws.MessageType, []byte, error) {
		readCtx, cancelRead := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelRead()
		return clientConn.Read(readCtx)
	}()
	require.Error(t, readErr)
	require.NotContains(t, string(payload), "Selected model is at capacity")

	select {
	case relayErr := <-serverErr:
		require.Error(t, relayErr)
		var failoverErr *UpstreamFailoverError
		require.ErrorAs(t, relayErr, &failoverErr)
		require.True(t, failoverErr.IsOpenAIModelCapacity())
	case <-time.After(5 * time.Second):
		t.Fatal("passthrough first-frame capacity failover did not return")
	}
}
