package repository

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDimensionTableUsesExternalSnapshot(t *testing.T) {
	repo := &channelMonitorV2Repository{}
	require.Equal(t, "groups", repo.dimensionTable("groups"))
	require.Equal(t, "users", repo.dimensionTable("users"))

	repo.source.enabled = true
	require.Equal(t, "channel_monitor_v2_source_groups", repo.dimensionTable("groups"))
	require.Equal(t, "channel_monitor_v2_source_users", repo.dimensionTable("users"))
	require.Equal(t, "accounts", repo.dimensionTable("accounts"))
}

func TestExternalRollupSecondsSkipCoarseHistograms(t *testing.T) {
	metrics := cmv2ExternalTable{rollup: true}
	require.Equal(t, []int64{300}, metrics.allowedSeconds(false))
	require.Equal(t, []int64{300, 3600, 43200, 86400}, metrics.allowedSeconds(true))

	histograms := cmv2ExternalTable{rollup: true, maxSeconds: 3600}
	require.Equal(t, []int64{300, 3600}, histograms.allowedSeconds(true))
	require.Empty(t, cmv2ExternalTable{}.allowedSeconds(true))
}
