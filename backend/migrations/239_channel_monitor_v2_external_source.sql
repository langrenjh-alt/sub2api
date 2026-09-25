-- Local snapshots for an external sub2api channel-monitor source.
-- Group and user rows are display labels only. They are not this instance's
-- groups or users, so billing and authorization tables stay untouched.

CREATE TABLE IF NOT EXISTS channel_monitor_v2_source_state (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cutover_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO channel_monitor_v2_source_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS channel_monitor_v2_source_groups (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS channel_monitor_v2_source_users (
    id BIGINT PRIMARY KEY,
    email TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT ''
);
