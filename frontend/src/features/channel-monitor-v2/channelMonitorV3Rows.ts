import type { MonitorHealth, MonitorMatrixRow, MonitorMetric } from '@/api/channelMonitorV2'

function emptyMetrics(): MonitorMetric {
  return {
    success_requests: 0,
    error_requests: 0,
    request_count: 0,
    token_count: 0,
    rpm: 0,
    tpm: 0,
    error_rate: 0,
    cache_rate: 0,
    cache_rate_numerator: 0,
    cache_rate_denominator: 0,
    ttft: { sample_count: 0, p50_ms: null, p95_ms: null, avg_ms: null },
    duration: { sample_count: 0, p50_ms: null, p95_ms: null, avg_ms: null },
  }
}

function emptyHealth(): MonitorHealth {
  return {
    overall: 'unknown',
    error_rate: 'unknown',
    ttft: 'unknown',
    cache: 'unknown',
    score: null,
    minimum_sample: 0,
  }
}

function requestCount(row: MonitorMatrixRow): number {
  return row.metrics?.request_count || 0
}

/** Prefer real traffic over a composite placeholder with the same group_id. */
export function preferChannelMonitorV3Row(a: MonitorMatrixRow, b: MonitorMatrixRow): MonitorMatrixRow {
  const aCount = requestCount(a)
  const bCount = requestCount(b)
  if (aCount !== bCount) return aCount >= bCount ? a : b
  if (a.platform === 'composite' && b.platform !== 'composite') return b
  if (b.platform === 'composite' && a.platform !== 'composite') return a
  return a
}

export function emptyChannelMonitorV3Row(group: {
  id: number
  name?: string
  platform?: string
}): MonitorMatrixRow {
  return {
    platform: group.platform || 'unknown',
    group_id: group.id,
    group_name: group.name,
    metrics: emptyMetrics(),
    health: emptyHealth(),
    buckets: [],
  }
}

/**
 * V3 cards are one-per-group. Matrix rows are keyed by platform+group, so a
 * composite group can emit both a placeholder and concrete-platform traffic.
 * Collapse to a single card and keep groups even when the window has no facts.
 */
export function buildChannelMonitorV3Cards(
  items: MonitorMatrixRow[] | null | undefined,
  groups: Array<{ id: number; name?: string; platform?: string }> = [],
): MonitorMatrixRow[] {
  const byGroup = new Map<number, MonitorMatrixRow>()

  for (const row of items || []) {
    const groupId = row.group_id
    if (groupId == null || groupId <= 0) continue
    const current = byGroup.get(groupId)
    byGroup.set(groupId, current ? preferChannelMonitorV3Row(current, row) : row)
  }

  for (const group of groups) {
    if (!group.id || group.id <= 0 || byGroup.has(group.id)) continue
    byGroup.set(group.id, emptyChannelMonitorV3Row(group))
  }

  return [...byGroup.values()].sort((a, b) => (a.group_id ?? 0) - (b.group_id ?? 0))
}
