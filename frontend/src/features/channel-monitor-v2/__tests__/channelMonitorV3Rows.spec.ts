import { describe, expect, it } from 'vitest'
import type { MonitorMatrixRow } from '@/api/channelMonitorV2'
import { buildChannelMonitorV3Cards, preferChannelMonitorV3Row } from '../channelMonitorV3Rows'

function row(partial: Partial<MonitorMatrixRow> & Pick<MonitorMatrixRow, 'platform' | 'group_id'>): MonitorMatrixRow {
  const { metrics, health, buckets, ...rest } = partial
  return {
    group_name: rest.group_name,
    metrics: {
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
      ...metrics,
    },
    health: {
      overall: 'unknown',
      error_rate: 'unknown',
      ttft: 'unknown',
      minimum_sample: 0,
      ...health,
    },
    buckets: buckets || [],
    ...rest,
  }
}

describe('buildChannelMonitorV3Cards', () => {
  it('drops rows without a real group id', () => {
    const cards = buildChannelMonitorV3Cards([
      row({ platform: 'openai', group_id: undefined, group_name: 'bare' }),
      row({ platform: 'openai', group_id: 0, group_name: 'zero' }),
    ])
    expect(cards).toEqual([])
  })

  it('keeps one card per group and prefers traffic over a composite placeholder', () => {
    const cards = buildChannelMonitorV3Cards([
      row({ platform: 'composite', group_id: 7, group_name: 'combo', metrics: { request_count: 0 } as MonitorMatrixRow['metrics'] }),
      row({ platform: 'openai', group_id: 7, group_name: 'combo', metrics: { request_count: 12 } as MonitorMatrixRow['metrics'] }),
    ])
    expect(cards).toHaveLength(1)
    expect(cards[0].platform).toBe('openai')
    expect(cards[0].metrics.request_count).toBe(12)
  })

  it('materializes dimension groups when the matrix window has no facts', () => {
    const cards = buildChannelMonitorV3Cards([], [
      { id: 3, name: 'gpt', platform: 'openai' },
      { id: 7, name: 'combo', platform: 'composite' },
    ])
    expect(cards.map(item => item.group_id)).toEqual([3, 7])
    expect(cards.every(item => item.metrics.request_count === 0)).toBe(true)
  })
})

describe('preferChannelMonitorV3Row', () => {
  it('keeps the concrete platform when request counts are equal', () => {
    const chosen = preferChannelMonitorV3Row(
      row({ platform: 'composite', group_id: 1 }),
      row({ platform: 'anthropic', group_id: 1 }),
    )
    expect(chosen.platform).toBe('anthropic')
  })
})
