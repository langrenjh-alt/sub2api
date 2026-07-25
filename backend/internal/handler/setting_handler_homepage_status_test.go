//go:build unit

package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type homepageStatusSummaryServiceStub struct {
	summary *service.HomepageStatusSummary
	err     error
}

func (s *homepageStatusSummaryServiceStub) GetSummary(context.Context) (*service.HomepageStatusSummary, error) {
	return s.summary, s.err
}

func TestSettingHandlerGetHomepageStatusUsesPublicWhitelist(t *testing.T) {
	gin.SetMode(gin.TestMode)
	uptime := 99.25
	checkedAt := time.Date(2026, time.July, 26, 1, 2, 3, 0, time.FixedZone("CST", 8*60*60))
	h := NewSettingHandler(nil, "test")
	h.SetHomepageStatusService(&homepageStatusSummaryServiceStub{summary: &service.HomepageStatusSummary{
		Enabled: true,
		Groups: []service.HomepageStatusGroup{
			{ID: 7, Name: "OpenAI", Platform: service.PlatformOpenAI, RateMultiplier: 1.5},
		},
		Monitors: []service.HomepageStatusMonitor{
			{ID: 9, Name: "Primary", Provider: service.PlatformOpenAI, Status: service.MonitorStatusOperational, Uptime7d: &uptime, LastCheckedAt: &checkedAt},
			{ID: 10, Name: "No history", Provider: service.PlatformAnthropic, Status: "unknown"},
		},
	}})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/settings/homepage-status", nil)
	h.GetHomepageStatus(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope struct {
		Code int `json:"code"`
		Data struct {
			Enabled  bool                         `json:"enabled"`
			Groups   []map[string]json.RawMessage `json:"groups"`
			Monitors []map[string]json.RawMessage `json:"monitors"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.Zero(t, envelope.Code)
	require.True(t, envelope.Data.Enabled)
	require.Len(t, envelope.Data.Groups, 1)
	require.ElementsMatch(t, []string{"id", "name", "platform", "rate_multiplier"}, mapKeys(envelope.Data.Groups[0]))
	require.Len(t, envelope.Data.Monitors, 2)
	require.ElementsMatch(t, []string{"id", "name", "provider", "status", "uptime_7d", "last_checked_at"}, mapKeys(envelope.Data.Monitors[0]))
	require.JSONEq(t, `99.25`, string(envelope.Data.Monitors[0]["uptime_7d"]))
	require.JSONEq(t, `"2026-07-25T17:02:03Z"`, string(envelope.Data.Monitors[0]["last_checked_at"]))
	require.JSONEq(t, `null`, string(envelope.Data.Monitors[1]["uptime_7d"]))
	require.JSONEq(t, `null`, string(envelope.Data.Monitors[1]["last_checked_at"]))
	require.JSONEq(t, `"unknown"`, string(envelope.Data.Monitors[1]["status"]))
}

func TestSettingHandlerGetHomepageStatusDisabledReturnsArrays(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewSettingHandler(nil, "test")
	h.SetHomepageStatusService(&homepageStatusSummaryServiceStub{summary: &service.HomepageStatusSummary{}})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/settings/homepage-status", nil)
	h.GetHomepageStatus(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope struct {
		Data struct {
			Enabled  bool  `json:"enabled"`
			Groups   []any `json:"groups"`
			Monitors []any `json:"monitors"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.False(t, envelope.Data.Enabled)
	require.Equal(t, []any{}, envelope.Data.Groups)
	require.Equal(t, []any{}, envelope.Data.Monitors)
}

func mapKeys(values map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}
