import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  apiClient: { get },
}))

import { getHomepageStatus } from '@/api/homepageStatus'

describe('homepage status API', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('requests the public homepage summary and forwards the abort signal', async () => {
    const response = {
      enabled: true,
      groups: [{ id: 3, name: 'Default', platform: 'openai', rate_multiplier: 1 }],
      monitors: [],
    }
    const controller = new AbortController()
    get.mockResolvedValueOnce({ data: response })

    await expect(getHomepageStatus({ signal: controller.signal })).resolves.toBe(response)
    expect(get).toHaveBeenCalledWith('/settings/homepage-status', {
      signal: controller.signal,
    })
  })
})
