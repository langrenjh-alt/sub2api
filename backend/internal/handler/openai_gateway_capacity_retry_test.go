package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/model"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

type capacityErrorPassthroughRepo struct {
	rules []*model.ErrorPassthroughRule
}

func (r *capacityErrorPassthroughRepo) List(context.Context) ([]*model.ErrorPassthroughRule, error) {
	return r.rules, nil
}

func (r *capacityErrorPassthroughRepo) GetByID(context.Context, int64) (*model.ErrorPassthroughRule, error) {
	return nil, nil
}

func (r *capacityErrorPassthroughRepo) Create(_ context.Context, rule *model.ErrorPassthroughRule) (*model.ErrorPassthroughRule, error) {
	return rule, nil
}

func (r *capacityErrorPassthroughRepo) Update(_ context.Context, rule *model.ErrorPassthroughRule) (*model.ErrorPassthroughRule, error) {
	return rule, nil
}

func (r *capacityErrorPassthroughRepo) Delete(context.Context, int64) error {
	return nil
}

func TestOpenAIGatewayHandler_CapacityFailoverExhaustedBypassesPassthroughRule(t *testing.T) {
	gin.SetMode(gin.TestMode)

	passthroughService := service.NewErrorPassthroughService(&capacityErrorPassthroughRepo{
		rules: []*model.ErrorPassthroughRule{
			{
				ID:              1,
				Name:            "passthrough all 502 errors",
				Enabled:         true,
				Priority:        1,
				ErrorCodes:      []int{http.StatusBadGateway},
				MatchMode:       model.MatchModeAny,
				Platforms:       []string{model.PlatformOpenAI},
				PassthroughCode: true,
				PassthroughBody: true,
			},
		},
	}, nil)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	h := &OpenAIGatewayHandler{errorPassthroughService: passthroughService}

	h.handleFailoverExhausted(c, &service.UpstreamFailoverError{
		StatusCode:   http.StatusBadGateway,
		ResponseBody: []byte(`{"error":{"type":"invalid_request_error","message":"Selected model is at capacity. Please try a different model."}}`),
	}, false)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.Equal(t, "upstream_error", gjson.GetBytes(recorder.Body.Bytes(), "error.type").String())
	require.Equal(t, "Upstream service temporarily unavailable", gjson.GetBytes(recorder.Body.Bytes(), "error.message").String())
	require.NotContains(t, recorder.Body.String(), "Selected model is at capacity")
}
