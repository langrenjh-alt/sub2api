package service

import (
	"context"
	"encoding/json"
	"strings"
)

const maxHomepageStatusGroupIDs = 100

// HomepageStatusRuntime is the public-homepage feature configuration used on
// each request. It intentionally excludes any group data; callers resolve the
// selected IDs against the current active groups before returning them.
type HomepageStatusRuntime struct {
	Enabled               bool
	GroupIDs              []int64
	ChannelMonitorEnabled bool
}

func normalizeHomepageStatusGroupIDs(ids []int64) []int64 {
	normalized := make([]int64, 0, min(len(ids), maxHomepageStatusGroupIDs))
	seen := make(map[int64]struct{}, min(len(ids), maxHomepageStatusGroupIDs))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
		if len(normalized) == maxHomepageStatusGroupIDs {
			break
		}
	}
	return normalized
}

func parseHomepageStatusGroupIDs(raw string) []int64 {
	if strings.TrimSpace(raw) == "" {
		return []int64{}
	}
	var ids []int64
	if err := json.Unmarshal([]byte(raw), &ids); err != nil {
		return []int64{}
	}
	return normalizeHomepageStatusGroupIDs(ids)
}

// GetHomepageStatusRuntime is fail-closed because the feature publishes a
// selected subset of internal group and monitor metadata without authentication.
func (s *SettingService) GetHomepageStatusRuntime(ctx context.Context) HomepageStatusRuntime {
	if s == nil || s.settingRepo == nil {
		return HomepageStatusRuntime{GroupIDs: []int64{}}
	}
	values, err := s.settingRepo.GetMultiple(ctx, []string{
		SettingKeyHomepageStatusEnabled,
		SettingKeyHomepageStatusGroupIDs,
		SettingKeyChannelMonitorEnabled,
	})
	if err != nil {
		return HomepageStatusRuntime{GroupIDs: []int64{}}
	}
	return HomepageStatusRuntime{
		Enabled:               values[SettingKeyHomepageStatusEnabled] == "true",
		GroupIDs:              parseHomepageStatusGroupIDs(values[SettingKeyHomepageStatusGroupIDs]),
		ChannelMonitorEnabled: values[SettingKeyChannelMonitorEnabled] == "true",
	}
}
