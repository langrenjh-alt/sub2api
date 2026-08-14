//go:build unit

package admin

import (
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestDiffSettingsIncludesHomepageStatusFields(t *testing.T) {
	before := &service.SystemSettings{HomepageStatusGroupIDs: []int64{1}}
	after := &service.SystemSettings{
		HomepageStatusEnabled:  true,
		HomepageStatusGroupIDs: []int64{1, 2},
	}

	changed := diffSettings(before, after, nil, nil, UpdateSettingsRequest{})
	require.Contains(t, changed, "homepage_status_enabled")
	require.Contains(t, changed, "homepage_status_group_ids")
}
