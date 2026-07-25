package handler

import (
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

type homepageStatusResponse struct {
	Enabled  bool                            `json:"enabled"`
	Groups   []homepageStatusGroupResponse   `json:"groups"`
	Monitors []homepageStatusMonitorResponse `json:"monitors"`
}

type homepageStatusGroupResponse struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	Platform       string  `json:"platform"`
	RateMultiplier float64 `json:"rate_multiplier"`
}

type homepageStatusMonitorResponse struct {
	ID            int64    `json:"id"`
	Name          string   `json:"name"`
	Provider      string   `json:"provider"`
	Status        string   `json:"status"`
	Uptime7d      *float64 `json:"uptime_7d"`
	LastCheckedAt *string  `json:"last_checked_at"`
}

// GetHomepageStatus returns the anonymous, explicitly allowlisted homepage summary.
// GET /api/v1/settings/homepage-status
func (h *SettingHandler) GetHomepageStatus(c *gin.Context) {
	if h.homepageStatusService == nil {
		response.InternalError(c, "homepage status service is not configured")
		return
	}
	summary, err := h.homepageStatusService.GetSummary(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, homepageStatusSummaryToResponse(summary))
}

func homepageStatusSummaryToResponse(summary *service.HomepageStatusSummary) homepageStatusResponse {
	out := homepageStatusResponse{
		Groups:   []homepageStatusGroupResponse{},
		Monitors: []homepageStatusMonitorResponse{},
	}
	if summary == nil {
		return out
	}
	out.Enabled = summary.Enabled
	for _, group := range summary.Groups {
		out.Groups = append(out.Groups, homepageStatusGroupResponse{
			ID:             group.ID,
			Name:           group.Name,
			Platform:       group.Platform,
			RateMultiplier: group.RateMultiplier,
		})
	}
	for _, monitor := range summary.Monitors {
		item := homepageStatusMonitorResponse{
			ID:       monitor.ID,
			Name:     monitor.Name,
			Provider: monitor.Provider,
			Status:   monitor.Status,
			Uptime7d: monitor.Uptime7d,
		}
		if monitor.LastCheckedAt != nil {
			formatted := monitor.LastCheckedAt.UTC().Format(time.RFC3339)
			item.LastCheckedAt = &formatted
		}
		out.Monitors = append(out.Monitors, item)
	}
	return out
}
