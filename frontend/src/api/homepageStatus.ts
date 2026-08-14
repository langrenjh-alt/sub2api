import { apiClient } from './client'

export interface HomepageStatusGroup {
  id: number
  name: string
  platform: string
  rate_multiplier: number
}

export interface HomepageStatusMonitor {
  id: number
  name: string
  provider: string
  status: string
  uptime_7d: number | null
  last_checked_at?: string | null
}

export interface HomepageStatusResponse {
  enabled: boolean
  groups: HomepageStatusGroup[]
  monitors: HomepageStatusMonitor[]
}

export async function getHomepageStatus(options?: {
  signal?: AbortSignal
}): Promise<HomepageStatusResponse> {
  const { data } = await apiClient.get<HomepageStatusResponse>('/settings/homepage-status', {
    signal: options?.signal,
  })
  return data
}
