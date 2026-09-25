package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/lib/pq"
)

// cmv2ExternalSource is a second sub2api database. V2 copies that instance's
// aggregate tables instead of scanning this instance's usage_logs.
type cmv2ExternalSource struct {
	enabled bool
	dsn     string
}

type cmv2ExternalTable struct {
	name    string
	columns []string
	rollup  bool
	// maxSeconds drops coarser rollup buckets. Histogram rollups at 12h/1d are
	// tens of millions of rows on the upstream monitor and are not copied.
	maxSeconds int
}

const cmv2ExternalInsertBatch = 400

func cmv2MetricColumns(rollup bool) []string {
	cols := []string{
		"bucket_start", "platform", "group_id", "model",
		"success_requests", "error_requests", "upstream_affected_requests", "upstream_attempt_count",
		"input_tokens", "output_tokens", "cache_creation_tokens", "cache_read_tokens",
		"ttft_sum_ms", "ttft_count", "duration_sum_ms", "duration_count", "computed_at",
	}
	if rollup {
		return append([]string{"bucket_start", "bucket_seconds"}, cols[1:]...)
	}
	return cols
}

func cmv2UserColumns(rollup bool) []string {
	cols := []string{
		"bucket_start", "platform", "group_id", "model", "user_id",
		"success_requests", "error_requests",
		"input_tokens", "output_tokens", "cache_creation_tokens", "cache_read_tokens",
		"ttft_sum_ms", "ttft_count", "duration_sum_ms", "duration_count", "computed_at",
	}
	if rollup {
		return append([]string{"bucket_start", "bucket_seconds"}, cols[1:]...)
	}
	return cols
}

func cmv2ErrorColumns(rollup bool) []string {
	cols := []string{
		"bucket_start", "platform", "group_id", "model",
		"error_category", "taxonomy_version", "error_requests",
	}
	if rollup {
		return append([]string{"bucket_start", "bucket_seconds"}, cols[1:]...)
	}
	return cols
}

func cmv2HistogramColumns(rollup bool) []string {
	cols := []string{
		"bucket_start", "platform", "group_id", "model", "user_id",
		"metric", "upper_bound_ms", "sample_count",
	}
	if rollup {
		return append([]string{"bucket_start", "bucket_seconds"}, cols[1:]...)
	}
	return cols
}

func cmv2ExternalTables() []cmv2ExternalTable {
	return []cmv2ExternalTable{
		{name: "channel_monitor_v2_metrics_1m", columns: cmv2MetricColumns(false)},
		{name: "channel_monitor_v2_metrics_rollup", columns: cmv2MetricColumns(true), rollup: true},
		{name: "channel_monitor_v2_user_metrics_1m", columns: cmv2UserColumns(false)},
		{name: "channel_monitor_v2_user_metrics_rollup", columns: cmv2UserColumns(true), rollup: true},
		{name: "channel_monitor_v2_error_metrics_1m", columns: cmv2ErrorColumns(false)},
		{name: "channel_monitor_v2_error_metrics_rollup", columns: cmv2ErrorColumns(true), rollup: true},
		{name: "channel_monitor_v2_latency_histograms_1m", columns: cmv2HistogramColumns(false)},
		{name: "channel_monitor_v2_latency_histograms_rollup", columns: cmv2HistogramColumns(true), rollup: true, maxSeconds: 3600},
	}
}

// ProvideChannelMonitorV2Repository wires the local fact store and, when
// configured, the external sub2api database V2 copies from.
func ProvideChannelMonitorV2Repository(db *sql.DB, cfg *config.Config) service.ChannelMonitorV2Repository {
	repo := NewChannelMonitorV2Repository(db).(*channelMonitorV2Repository)
	if cfg != nil && cfg.ChannelMonitorV2.Source.Active() {
		repo.source = cmv2ExternalSource{enabled: true, dsn: cfg.ChannelMonitorV2.Source.DSN()}
	}
	return repo
}

func (r *channelMonitorV2Repository) dimensionTable(name string) string {
	if r != nil && r.source.enabled {
		switch name {
		case "groups":
			return "channel_monitor_v2_source_groups"
		case "users":
			return "channel_monitor_v2_source_users"
		}
	}
	return name
}

func (r *channelMonitorV2Repository) errorLogDB(ctx context.Context) (*sql.DB, error) {
	if r == nil || !r.source.enabled {
		return r.db, nil
	}
	return r.externalDB(ctx)
}

func (r *channelMonitorV2Repository) externalDB(ctx context.Context) (*sql.DB, error) {
	r.srcMu.Lock()
	defer r.srcMu.Unlock()
	if r.srcDB != nil {
		pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		err := r.srcDB.PingContext(pingCtx)
		cancel()
		if err == nil {
			return r.srcDB, nil
		}
		_ = r.srcDB.Close()
		r.srcDB = nil
	}
	db, err := sql.Open("postgres", r.source.dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	err = db.PingContext(pingCtx)
	cancel()
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	r.srcDB = db
	return db, nil
}

// PrepareExternalSource clears local usage-derived facts once so they cannot
// mix with the external monitor. reset is true only on that cutover.
func (r *channelMonitorV2Repository) PrepareExternalSource(ctx context.Context) (bool, bool, error) {
	if r == nil || !r.source.enabled {
		return false, false, nil
	}
	var done bool
	err := r.db.QueryRowContext(ctx, `SELECT cutover_at IS NOT NULL FROM channel_monitor_v2_source_state WHERE id = 1`).Scan(&done)
	if err == sql.ErrNoRows {
		done = false
	} else if err != nil {
		return true, false, err
	}
	if done {
		return true, false, nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return true, false, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, `TRUNCATE TABLE
		channel_monitor_v2_latency_histograms_rollup,
		channel_monitor_v2_error_metrics_rollup,
		channel_monitor_v2_user_metrics_rollup,
		channel_monitor_v2_metrics_rollup,
		channel_monitor_v2_latency_histograms_1m,
		channel_monitor_v2_error_metrics_1m,
		channel_monitor_v2_user_metrics_1m,
		channel_monitor_v2_metrics_1m`); err != nil {
		return true, false, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE channel_monitor_v2_watermarks SET
		usage_coverage_start = NULL,
		error_coverage_start = NULL,
		data_through = NULL,
		last_successful_at = NULL,
		backfill_cursor = NULL,
		updated_at = NOW()
		WHERE id = 1`); err != nil {
		return true, false, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE channel_monitor_v2_source_state SET cutover_at = NOW(), updated_at = NOW() WHERE id = 1`); err != nil {
		return true, false, err
	}
	if err = tx.Commit(); err != nil {
		return true, false, err
	}
	return true, true, nil
}

func (r *channelMonitorV2Repository) syncExternalRange(ctx context.Context, start, end time.Time) error {
	src, err := r.externalDB(ctx)
	if err != nil {
		return fmt.Errorf("connect channel monitor v2 source: %w", err)
	}
	if err = r.syncExternalIdentities(ctx, src); err != nil {
		return err
	}
	includeCoarse := end.Sub(start) >= time.Hour
	r.srcMu.Lock()
	if !includeCoarse && (r.lastCoarseSync.IsZero() || time.Since(r.lastCoarseSync) >= 10*time.Minute) {
		includeCoarse = true
	}
	r.srcMu.Unlock()

	copied := 0
	for _, table := range cmv2ExternalTables() {
		n, copyErr := r.copyExternalTable(ctx, src, table, start, end, includeCoarse)
		if copyErr != nil {
			return fmt.Errorf("copy %s: %w", table.name, copyErr)
		}
		copied += n
	}
	if err = r.finishExternalWindow(ctx, start, end); err != nil {
		return err
	}
	if includeCoarse {
		r.srcMu.Lock()
		r.lastCoarseSync = time.Now()
		r.srcMu.Unlock()
	}
	logger.LegacyPrintf("repository.channel_monitor_v2", "[ChannelMonitorV2] synced external %s .. %s rows=%d coarse=%t", start.Format(time.RFC3339), end.Format(time.RFC3339), copied, includeCoarse)
	return nil
}

func (table cmv2ExternalTable) allowedSeconds(includeCoarse bool) []int64 {
	if !table.rollup {
		return nil
	}
	all := []int{300}
	if includeCoarse {
		all = append(all, 3600, 43200, 86400)
	}
	out := make([]int64, 0, len(all))
	for _, seconds := range all {
		if table.maxSeconds > 0 && seconds > table.maxSeconds {
			continue
		}
		out = append(out, int64(seconds))
	}
	return out
}

func (r *channelMonitorV2Repository) copyExternalTable(ctx context.Context, src *sql.DB, table cmv2ExternalTable, start, end time.Time, includeCoarse bool) (int, error) {
	seconds := table.allowedSeconds(includeCoarse)
	if table.rollup && len(seconds) == 0 {
		return 0, nil
	}
	where := "WHERE bucket_start >= $1 AND bucket_start < $2"
	args := []any{start, end}
	deleteSQL := "DELETE FROM " + table.name + " WHERE bucket_start >= $1 AND bucket_start < $2"
	deleteArgs := []any{start, end}
	if table.rollup {
		where = "WHERE bucket_start < $2 AND bucket_start + make_interval(secs => bucket_seconds) > $1 AND bucket_seconds = ANY($3)"
		args = []any{start, end, pq.Array(seconds)}
		deleteSQL = "DELETE FROM " + table.name + " WHERE bucket_start < $2 AND bucket_start + make_interval(secs => bucket_seconds) > $1 AND bucket_seconds = ANY($3)"
		deleteArgs = args
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, deleteSQL, deleteArgs...); err != nil {
		return 0, err
	}
	rows, err := src.QueryContext(ctx, "SELECT "+strings.Join(table.columns, ",")+" FROM "+table.name+" "+where, args...)
	if err != nil {
		return 0, err
	}
	defer func() { _ = rows.Close() }()

	copied := 0
	batch := make([][]any, 0, cmv2ExternalInsertBatch)
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		if err := cmv2InsertBatch(ctx, tx, table.name, table.columns, batch); err != nil {
			return err
		}
		copied += len(batch)
		batch = batch[:0]
		return nil
	}
	for rows.Next() {
		values, scanErr := cmv2ScanRow(rows, table.columns)
		if scanErr != nil {
			return copied, scanErr
		}
		batch = append(batch, values)
		if len(batch) >= cmv2ExternalInsertBatch {
			if err = flush(); err != nil {
				return copied, err
			}
		}
	}
	if err = rows.Err(); err != nil {
		return copied, err
	}
	if err = flush(); err != nil {
		return copied, err
	}
	if err = tx.Commit(); err != nil {
		return copied, err
	}
	return copied, nil
}

func cmv2ScanRow(rows *sql.Rows, columns []string) ([]any, error) {
	holders := make([]any, len(columns))
	dest := make([]any, len(columns))
	for i, column := range columns {
		switch column {
		case "bucket_start", "computed_at":
			holders[i] = new(time.Time)
		case "platform", "model", "error_category", "metric":
			holders[i] = new(string)
		default:
			holders[i] = new(int64)
		}
		dest[i] = holders[i]
	}
	if err := rows.Scan(dest...); err != nil {
		return nil, err
	}
	values := make([]any, len(holders))
	for i, holder := range holders {
		switch typed := holder.(type) {
		case *time.Time:
			values[i] = *typed
		case *string:
			values[i] = *typed
		case *int64:
			values[i] = *typed
		default:
			return nil, fmt.Errorf("unsupported scan holder %T", holder)
		}
	}
	return values, nil
}

func cmv2InsertBatch(ctx context.Context, tx *sql.Tx, table string, columns []string, rows [][]any) error {
	var b strings.Builder
	args := make([]any, 0, len(rows)*len(columns))
	b.WriteString("INSERT INTO ")
	b.WriteString(table)
	b.WriteString(" (")
	b.WriteString(strings.Join(columns, ","))
	b.WriteString(") VALUES ")
	n := 1
	for i, row := range rows {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteByte('(')
		for c := range columns {
			if c > 0 {
				b.WriteByte(',')
			}
			b.WriteByte('$')
			b.WriteString(strconv.Itoa(n))
			n++
			args = append(args, row[c])
		}
		b.WriteByte(')')
	}
	b.WriteString(" ON CONFLICT DO NOTHING")
	_, err := tx.ExecContext(ctx, b.String(), args...)
	return err
}

func (r *channelMonitorV2Repository) syncExternalIdentities(ctx context.Context, src *sql.DB) error {
	groupRows, err := src.QueryContext(ctx, `SELECT id, COALESCE(name, ''), lower(COALESCE(NULLIF(TRIM(platform), ''), 'unknown')), COALESCE(status, ''), deleted_at FROM groups`)
	if err != nil {
		return fmt.Errorf("read source groups: %w", err)
	}
	defer func() { _ = groupRows.Close() }()
	type groupRow struct {
		id       int64
		name     string
		platform string
		status   string
		deleted  sql.NullTime
	}
	var groups []groupRow
	for groupRows.Next() {
		var row groupRow
		if err = groupRows.Scan(&row.id, &row.name, &row.platform, &row.status, &row.deleted); err != nil {
			return err
		}
		groups = append(groups, row)
	}
	if err = groupRows.Err(); err != nil {
		return err
	}

	userRows, err := src.QueryContext(ctx, `SELECT id, COALESCE(email, ''), COALESCE(username, '') FROM users`)
	if err != nil {
		return fmt.Errorf("read source users: %w", err)
	}
	defer func() { _ = userRows.Close() }()
	type userRow struct {
		id       int64
		email    string
		username string
	}
	var users []userRow
	for userRows.Next() {
		var row userRow
		if err = userRows.Scan(&row.id, &row.email, &row.username); err != nil {
			return err
		}
		users = append(users, row)
	}
	if err = userRows.Err(); err != nil {
		return err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, `DELETE FROM channel_monitor_v2_source_groups`); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM channel_monitor_v2_source_users`); err != nil {
		return err
	}
	if len(groups) > 0 {
		rows := make([][]any, len(groups))
		for i, row := range groups {
			var deleted any
			if row.deleted.Valid {
				deleted = row.deleted.Time
			}
			rows[i] = []any{row.id, row.name, row.platform, row.status, deleted}
		}
		if err = cmv2InsertBatch(ctx, tx, "channel_monitor_v2_source_groups", []string{"id", "name", "platform", "status", "deleted_at"}, rows); err != nil {
			return err
		}
	}
	if len(users) > 0 {
		rows := make([][]any, len(users))
		for i, row := range users {
			rows[i] = []any{row.id, row.email, row.username}
		}
		for i := 0; i < len(rows); i += cmv2ExternalInsertBatch {
			end := i + cmv2ExternalInsertBatch
			if end > len(rows) {
				end = len(rows)
			}
			if err = cmv2InsertBatch(ctx, tx, "channel_monitor_v2_source_users", []string{"id", "email", "username"}, rows[i:end]); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

func (r *channelMonitorV2Repository) finishExternalWindow(ctx context.Context, start, end time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	now := time.Now().UTC().Truncate(time.Minute)
	if err = r.pruneChannelMonitorV2Retention(ctx, tx, now); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, channelMonitorV2WatermarkSQL, start, end); err != nil {
		return err
	}
	return tx.Commit()
}
