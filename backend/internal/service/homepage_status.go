package service

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

const (
	homepageStatusSummaryCacheTTL    = 15 * time.Second
	homepageStatusSummaryLoadTimeout = 5 * time.Second
)

type HomepageStatusGroupReader interface {
	ListActive(ctx context.Context) ([]Group, error)
}

type HomepageStatusMonitorReader interface {
	ListEnabled(ctx context.Context) ([]*ChannelMonitor, error)
	ListLatestForMonitorIDs(ctx context.Context, ids []int64) (map[int64][]*ChannelMonitorLatest, error)
	ComputeAvailabilityForMonitors(ctx context.Context, ids []int64, windowDays int) (map[int64][]*ChannelMonitorAvailability, error)
}

type HomepageStatusSettingReader interface {
	GetHomepageStatusRuntime(ctx context.Context) HomepageStatusRuntime
}

type HomepageStatusGroup struct {
	ID             int64
	Name           string
	Platform       string
	RateMultiplier float64
}

type HomepageStatusMonitor struct {
	ID            int64
	Name          string
	Provider      string
	Status        string
	Uptime7d      *float64
	LastCheckedAt *time.Time
}

type HomepageStatusSummary struct {
	Enabled  bool
	Groups   []HomepageStatusGroup
	Monitors []HomepageStatusMonitor
}

type HomepageStatusService struct {
	groups   HomepageStatusGroupReader
	monitors HomepageStatusMonitorReader
	settings HomepageStatusSettingReader

	cacheMu  sync.RWMutex
	cache    *homepageStatusCacheEntry
	cacheTTL time.Duration
	cacheSF  singleflight.Group
}

type homepageStatusCacheEntry struct {
	key       string
	expiresAt time.Time
	summary   *HomepageStatusSummary
}

func NewHomepageStatusService(
	groups HomepageStatusGroupReader,
	monitors HomepageStatusMonitorReader,
	settings HomepageStatusSettingReader,
) *HomepageStatusService {
	return &HomepageStatusService{
		groups:   groups,
		monitors: monitors,
		settings: settings,
		cacheTTL: homepageStatusSummaryCacheTTL,
	}
}

// GetSummary builds the anonymous homepage payload from explicit allowlists.
// No group or monitor repository is touched while the feature is disabled.
func (s *HomepageStatusService) GetSummary(ctx context.Context) (*HomepageStatusSummary, error) {
	summary := emptyHomepageStatusSummary()
	if s == nil || s.settings == nil {
		return summary, nil
	}

	runtime := s.settings.GetHomepageStatusRuntime(ctx)
	if !runtime.Enabled {
		return summary, nil
	}
	runtime.GroupIDs = normalizeHomepageStatusGroupIDs(runtime.GroupIDs)
	cacheKey := homepageStatusRuntimeCacheKey(runtime)
	if cached := s.cachedSummary(cacheKey, time.Now()); cached != nil {
		return cached, nil
	}

	loadedCh := s.cacheSF.DoChan(cacheKey, func() (any, error) {
		if cached := s.cachedSummary(cacheKey, time.Now()); cached != nil {
			return cached, nil
		}
		loadCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), homepageStatusSummaryLoadTimeout)
		defer cancel()
		fresh, loadErr := s.loadSummary(loadCtx, runtime)
		if loadErr != nil {
			return nil, loadErr
		}
		s.cacheSummary(cacheKey, fresh, time.Now())
		return fresh, nil
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case loaded := <-loadedCh:
		if loaded.Err != nil {
			return nil, loaded.Err
		}
		return cloneHomepageStatusSummary(loaded.Val.(*HomepageStatusSummary)), nil
	}
}

func (s *HomepageStatusService) loadSummary(ctx context.Context, runtime HomepageStatusRuntime) (*HomepageStatusSummary, error) {
	summary := emptyHomepageStatusSummary()
	summary.Enabled = true

	groups, err := s.loadGroups(ctx, runtime.GroupIDs)
	if err != nil {
		return nil, err
	}
	summary.Groups = groups

	if runtime.ChannelMonitorEnabled {
		summary.Monitors = s.loadMonitors(ctx)
	}
	return summary, nil
}

func emptyHomepageStatusSummary() *HomepageStatusSummary {
	return &HomepageStatusSummary{
		Groups:   []HomepageStatusGroup{},
		Monitors: []HomepageStatusMonitor{},
	}
}

func homepageStatusRuntimeCacheKey(runtime HomepageStatusRuntime) string {
	var key strings.Builder
	key.WriteString("monitor=")
	key.WriteString(strconv.FormatBool(runtime.ChannelMonitorEnabled))
	key.WriteString(";groups=")
	for _, id := range runtime.GroupIDs {
		key.WriteString(strconv.FormatInt(id, 10))
		key.WriteByte(',')
	}
	return key.String()
}

func (s *HomepageStatusService) cachedSummary(key string, now time.Time) *HomepageStatusSummary {
	if s == nil || s.cacheTTL <= 0 {
		return nil
	}
	s.cacheMu.RLock()
	entry := s.cache
	if entry == nil || entry.key != key || !now.Before(entry.expiresAt) {
		s.cacheMu.RUnlock()
		return nil
	}
	summary := cloneHomepageStatusSummary(entry.summary)
	s.cacheMu.RUnlock()
	return summary
}

func (s *HomepageStatusService) cacheSummary(key string, summary *HomepageStatusSummary, now time.Time) {
	if s == nil || s.cacheTTL <= 0 || summary == nil {
		return
	}
	s.cacheMu.Lock()
	s.cache = &homepageStatusCacheEntry{
		key:       key,
		expiresAt: now.Add(s.cacheTTL),
		summary:   cloneHomepageStatusSummary(summary),
	}
	s.cacheMu.Unlock()
}

func cloneHomepageStatusSummary(summary *HomepageStatusSummary) *HomepageStatusSummary {
	out := emptyHomepageStatusSummary()
	if summary == nil {
		return out
	}
	out.Enabled = summary.Enabled
	out.Groups = append(out.Groups, summary.Groups...)
	out.Monitors = make([]HomepageStatusMonitor, 0, len(summary.Monitors))
	for _, monitor := range summary.Monitors {
		cloned := monitor
		if monitor.Uptime7d != nil {
			uptime := *monitor.Uptime7d
			cloned.Uptime7d = &uptime
		}
		if monitor.LastCheckedAt != nil {
			checkedAt := *monitor.LastCheckedAt
			cloned.LastCheckedAt = &checkedAt
		}
		out.Monitors = append(out.Monitors, cloned)
	}
	return out
}

func (s *HomepageStatusService) loadGroups(ctx context.Context, selectedIDs []int64) ([]HomepageStatusGroup, error) {
	out := []HomepageStatusGroup{}
	if len(selectedIDs) == 0 {
		return out, nil
	}
	if s.groups == nil {
		return nil, fmt.Errorf("homepage status group reader is not configured")
	}
	activeGroups, err := s.groups.ListActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("list homepage status groups: %w", err)
	}
	selected := make(map[int64]struct{}, len(selectedIDs))
	for _, id := range selectedIDs {
		selected[id] = struct{}{}
	}
	for i := range activeGroups {
		group := activeGroups[i]
		if group.Status != StatusActive {
			continue
		}
		if _, ok := selected[group.ID]; !ok {
			continue
		}
		out = append(out, HomepageStatusGroup{
			ID:             group.ID,
			Name:           group.Name,
			Platform:       group.Platform,
			RateMultiplier: group.RateMultiplier,
		})
	}
	return out, nil
}

func (s *HomepageStatusService) loadMonitors(ctx context.Context) []HomepageStatusMonitor {
	out := []HomepageStatusMonitor{}
	if s.monitors == nil {
		slog.Warn("homepage_status: monitor reader is not configured")
		return out
	}
	monitors, err := s.monitors.ListEnabled(ctx)
	if err != nil {
		slog.Warn("homepage_status: list enabled monitors failed", "error", err)
		return out
	}
	enabled := make([]*ChannelMonitor, 0, len(monitors))
	for _, monitor := range monitors {
		if monitor != nil && monitor.Enabled {
			enabled = append(enabled, monitor)
		}
	}
	if len(enabled) == 0 {
		return out
	}
	sort.SliceStable(enabled, func(i, j int) bool { return enabled[i].ID < enabled[j].ID })

	ids := make([]int64, 0, len(enabled))
	for _, monitor := range enabled {
		ids = append(ids, monitor.ID)
	}
	latestByMonitor, err := s.monitors.ListLatestForMonitorIDs(ctx, ids)
	if err != nil {
		slog.Warn("homepage_status: load monitor status failed", "error", err)
		latestByMonitor = map[int64][]*ChannelMonitorLatest{}
	}
	availabilityByMonitor, err := s.monitors.ComputeAvailabilityForMonitors(ctx, ids, monitorAvailability7Days)
	if err != nil {
		slog.Warn("homepage_status: load monitor uptime failed", "error", err)
		availabilityByMonitor = map[int64][]*ChannelMonitorAvailability{}
	}

	for _, monitor := range enabled {
		item := HomepageStatusMonitor{
			ID:       monitor.ID,
			Name:     monitor.Name,
			Provider: monitor.Provider,
			Status:   "unknown",
		}
		if latest := findHomepageMonitorLatest(latestByMonitor[monitor.ID], monitor.PrimaryModel); latest != nil {
			item.Status = latest.Status
			checkedAt := latest.CheckedAt
			item.LastCheckedAt = &checkedAt
		}
		if availability := findHomepageMonitorAvailability(availabilityByMonitor[monitor.ID], monitor.PrimaryModel); availability != nil && availability.TotalChecks > 0 {
			uptime := availability.AvailabilityPct
			item.Uptime7d = &uptime
		}
		out = append(out, item)
	}
	return out
}

func findHomepageMonitorLatest(rows []*ChannelMonitorLatest, primaryModel string) *ChannelMonitorLatest {
	for _, row := range rows {
		if row != nil && row.Model == primaryModel {
			return row
		}
	}
	return nil
}

func findHomepageMonitorAvailability(rows []*ChannelMonitorAvailability, primaryModel string) *ChannelMonitorAvailability {
	for _, row := range rows {
		if row != nil && row.Model == primaryModel {
			return row
		}
	}
	return nil
}
