import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CryptoNetworkSelector from '@/components/payment/CryptoNetworkSelector.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

describe('CryptoNetworkSelector', () => {
  it('renders the enabled checkout chains and emits the selected network', async () => {
    const wrapper = mount(CryptoNetworkSelector, {
      props: {
        selected: 'tron',
        networks: ['tron', 'bsc', 'sol'],
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(wrapper.get('[data-testid="crypto-network-grid"]').text()).toContain('BSC')

    await buttons[1].trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['bsc'])
  })
})
