import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '@/stores/app'

const isV1 = vi.fn(() => false)
const isV2 = vi.fn(() => true)

vi.mock('@/utils/featureFlags', () => ({
  isChannelMonitorV1Mode: () => isV1(),
  isChannelMonitorV2Mode: () => isV2(),
}))

vi.mock('../ChannelStatusV1View.vue', () => ({
  default: defineComponent({ name: 'ChannelStatusV1View', setup: () => () => h('div', { 'data-testid': 'v1' }) }),
}))
vi.mock('../ChannelStatusV2View.vue', () => ({
  default: defineComponent({ name: 'ChannelStatusV2View', setup: () => () => h('div', { 'data-testid': 'v2' }) }),
}))
vi.mock('@/components/layout/AppLayout.vue', () => ({
  default: defineComponent({
    name: 'AppLayout',
    setup: (_, { slots }) => () => h('div', { 'data-testid': 'layout' }, slots.default?.()),
  }),
}))

vi.mock('../ChannelStatusV3View.vue', () => ({
  default: defineComponent({ name: 'ChannelStatusV3View', setup: () => () => h('div', { 'data-testid': 'v3' }) }),
}))

import ChannelStatusView from '../ChannelStatusView.vue'

describe('ChannelStatusView mode switch', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    isV1.mockReset()
    isV2.mockReset()
    pinia = createPinia()
    setActivePinia(pinia)
    const appStore = useAppStore()
    appStore.publicSettingsLoaded = true
    vi.spyOn(appStore, 'fetchPublicSettings').mockResolvedValue(null)
  })

  function mountView() {
    return mount(ChannelStatusView, {
      global: {
        plugins: [pinia],
        mocks: { $route: { query: {} } },
      },
    })
  }

  it('renders V3 by default when V2 passive mode is active', () => {
    isV1.mockReturnValue(false)
    isV2.mockReturnValue(true)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="v3"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="v1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="v2"]').exists()).toBe(false)
  })

  it('renders V1 when in v1 mode', () => {
    isV1.mockReturnValue(true)
    isV2.mockReturnValue(false)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="v1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="v2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="v3"]').exists()).toBe(false)
  })

  it('does not mount V1 empty state before public settings resolve', async () => {
    const appStore = useAppStore()
    appStore.publicSettingsLoaded = false
    isV1.mockReturnValue(true)
    isV2.mockReturnValue(false)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="monitor-mode-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="v1"]').exists()).toBe(false)
    appStore.publicSettingsLoaded = true
    await nextTick()
    expect(wrapper.find('[data-testid="v1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="monitor-mode-loading"]').exists()).toBe(false)
  })
})
