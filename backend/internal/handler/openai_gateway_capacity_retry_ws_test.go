package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	middleware "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	coderws "github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestOpenAIResponsesWebSocket_ModelCapacityRetriesSamePoolAccountWithoutExposingError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var connectionCount atomic.Int32
	var payloadMu sync.Mutex
	var payloads [][]byte
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := coderws.Accept(w, r, &coderws.AcceptOptions{CompressionMode: coderws.CompressionContextTakeover})
		if err != nil {
			return
		}
		defer func() { _ = conn.CloseNow() }()

		connection := connectionCount.Add(1)
		readCtx, cancelRead := context.WithTimeout(r.Context(), 3*time.Second)
		msgType, payload, readErr := conn.Read(readCtx)
		cancelRead()
		if readErr != nil || msgType != coderws.MessageText {
			return
		}
		payloadMu.Lock()
		payloads = append(payloads, append([]byte(nil), payload...))
		payloadMu.Unlock()

		response := `{"type":"response.failed","response":{"id":"resp_capacity_retry","model":"gpt-5.1","error":{"type":"invalid_request_error","message":"Selected model is at capacity. Please try a different model."}}}`
		if connection > 1 {
			response = `{"type":"response.completed","response":{"id":"resp_capacity_retry_ok","model":"gpt-5.1","usage":{"input_tokens":1,"output_tokens":1}}}`
		}
		writeCtx, cancelWrite := context.WithTimeout(r.Context(), 3*time.Second)
		_ = conn.Write(writeCtx, coderws.MessageText, []byte(response))
		cancelWrite()
	}))
	defer upstream.Close()

	groupID := int64(4401)
	accounts := []service.Account{{
		ID:          9951,
		Name:        "openai-ws-capacity-pool",
		Platform:    service.PlatformOpenAI,
		Type:        service.AccountTypeAPIKey,
		Status:      service.StatusActive,
		Schedulable: true,
		Concurrency: 1,
		Priority:    1,
		Credentials: map[string]any{
			"api_key":               "sk-capacity-pool",
			"base_url":              upstream.URL,
			"pool_mode":             true,
			"pool_mode_retry_count": float64(1),
		},
		Extra: map[string]any{"responses_websockets_v2_enabled": true},
	}}
	accountRepo := &openAIWSFailoverHandlerAccountRepoStub{accounts: accounts}
	cfg := &config.Config{RunMode: config.RunModeSimple}
	cfg.Default.RateMultiplier = 1
	cfg.Security.URLAllowlist.Enabled = false
	cfg.Security.URLAllowlist.AllowInsecureHTTP = true
	cfg.Gateway.OpenAIWS.Enabled = true
	cfg.Gateway.OpenAIWS.APIKeyEnabled = true
	cfg.Gateway.OpenAIWS.ResponsesWebsocketsV2 = true
	cfg.Gateway.OpenAIWS.DialTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.ReadTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.WriteTimeoutSeconds = 3
	cfg.Gateway.MaxAccountSwitches = 2

	billingCache := service.NewBillingCacheService(nil, nil, nil, nil, nil, nil, cfg, nil)
	t.Cleanup(billingCache.Stop)
	gateway := service.NewOpenAIGatewayService(
		accountRepo,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		cfg,
		nil,
		nil,
		service.NewBillingService(cfg, nil),
		nil,
		billingCache,
		nil,
		&service.DeferredService{},
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
	)
	cache := &concurrencyCacheMock{
		acquireUserSlotFn: func(context.Context, int64, int, string) (bool, error) { return true, nil },
		acquireAccountSlotFn: func(context.Context, int64, int, string) (bool, error) {
			return true, nil
		},
	}
	h := &OpenAIGatewayHandler{
		gatewayService:      gateway,
		billingCacheService: billingCache,
		apiKeyService:       &service.APIKeyService{},
		concurrencyHelper:   NewConcurrencyHelper(service.NewConcurrencyService(cache), SSEPingFormatNone, time.Second),
		maxAccountSwitches:  2,
	}

	apiKey := &service.APIKey{
		ID:      1851,
		GroupID: &groupID,
		User:    &service.User{ID: 1751, Status: service.StatusActive},
		Group:   &service.Group{ID: groupID, Platform: service.PlatformOpenAI, Status: service.StatusActive},
	}
	handlerDone := make(chan struct{})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(middleware.ContextKeyAPIKey), apiKey)
		c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: apiKey.User.ID, Concurrency: 1})
		c.Next()
	})
	router.GET("/openai/v1/responses", func(c *gin.Context) {
		h.ResponsesWebSocket(c)
		close(handlerDone)
	})
	handlerServer := httptest.NewServer(router)
	defer handlerServer.Close()

	dialCtx, cancelDial := context.WithTimeout(context.Background(), 3*time.Second)
	clientConn, _, err := coderws.Dial(
		dialCtx,
		"ws"+strings.TrimPrefix(handlerServer.URL, "http")+"/openai/v1/responses",
		&coderws.DialOptions{CompressionMode: coderws.CompressionContextTakeover},
	)
	cancelDial()
	require.NoError(t, err)
	defer func() { _ = clientConn.CloseNow() }()

	writeCtx, cancelWrite := context.WithTimeout(context.Background(), 3*time.Second)
	err = clientConn.Write(writeCtx, coderws.MessageText, []byte(`{"type":"response.create","model":"gpt-5.1","stream":false}`))
	cancelWrite()
	require.NoError(t, err)

	readCtx, cancelRead := context.WithTimeout(context.Background(), 6*time.Second)
	var event []byte
	for {
		_, event, err = clientConn.Read(readCtx)
		require.NoError(t, err)
		require.NotContains(t, string(event), "Selected model is at capacity")
		if gjson.GetBytes(event, "type").String() == "response.completed" {
			break
		}
	}
	cancelRead()
	require.Equal(t, "resp_capacity_retry_ok", gjson.GetBytes(event, "response.id").String())
	require.NoError(t, clientConn.Close(coderws.StatusNormalClosure, "done"))

	select {
	case <-handlerDone:
	case <-time.After(5 * time.Second):
		t.Fatal("websocket handler did not finish after same-account retry")
	}
	require.Equal(t, int32(2), connectionCount.Load())
	payloadMu.Lock()
	gotPayloads := append([][]byte(nil), payloads...)
	payloadMu.Unlock()
	require.Len(t, gotPayloads, 2)
	require.Equal(t, "response.create", gjson.GetBytes(gotPayloads[0], "type").String())
	require.Equal(t, "response.create", gjson.GetBytes(gotPayloads[1], "type").String())
	require.Equal(t, "gpt-5.1", gjson.GetBytes(gotPayloads[1], "model").String())
}
