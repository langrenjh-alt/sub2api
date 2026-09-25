package migrations

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelMonitorV2ExternalSourceMigration(t *testing.T) {
	content, err := FS.ReadFile("239_channel_monitor_v2_external_source.sql")
	require.NoError(t, err)
	sql := strings.Join(strings.Fields(string(content)), " ")
	require.Contains(t, sql, "CREATE TABLE IF NOT EXISTS channel_monitor_v2_source_state")
	require.Contains(t, sql, "CREATE TABLE IF NOT EXISTS channel_monitor_v2_source_groups")
	require.Contains(t, sql, "CREATE TABLE IF NOT EXISTS channel_monitor_v2_source_users")
	require.NotContains(t, sql, "usage_logs")
}
