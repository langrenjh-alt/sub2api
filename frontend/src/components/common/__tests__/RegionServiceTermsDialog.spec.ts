import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import RegionServiceTermsDialog from '@/components/common/RegionServiceTermsDialog.vue'
import {
  REGION_SERVICE_TERMS_REVISION,
  REGION_SERVICE_TERMS_STORAGE_KEY
} from '@/components/common/regionServiceTerms'

const routeState = reactive({
  path: '/home'
})

vi.mock('vue-router', () => ({
  useRoute: () => routeState
}))

const BaseDialogStub = {
  props: [
    'show',
    'title',
    'width',
    'closeOnEscape',
    'closeOnClickOutside',
    'showCloseButton',
    'zIndex'
  ],
  emits: ['close'],
  template: '<div v-if="show"><slot /><slot name="footer" /></div>'
}

describe('RegionServiceTermsDialog', () => {
  beforeEach(() => {
    routeState.path = '/home'
    window.localStorage.clear()
  })

  it('requires checking consent before continuing on target routes', async () => {
    routeState.path = '/login'

    const wrapper = mount(RegionServiceTermsDialog, {
      global: {
        stubs: {
          BaseDialog: BaseDialogStub,
          Icon: true
        }
      }
    })

    expect(wrapper.text()).toContain('请先勾选同意后，才能继续进入登录 / 注册')

    const checkbox = wrapper.get('input[type="checkbox"]')
    const button = wrapper.get('button[type="button"]')

    expect(button.attributes('disabled')).toBeDefined()

    await checkbox.setChecked(true)
    await nextTick()

    expect(wrapper.get('button[type="button"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('button[type="button"]').trigger('click')
    await nextTick()

    const stored = JSON.parse(window.localStorage.getItem(REGION_SERVICE_TERMS_STORAGE_KEY) ?? '{}')
    expect(stored.revision).toBe(REGION_SERVICE_TERMS_REVISION)
    expect(typeof stored.accepted_at).toBe('string')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('stays hidden on unrelated routes', () => {
    routeState.path = '/dashboard'

    const wrapper = mount(RegionServiceTermsDialog, {
      global: {
        stubs: {
          BaseDialog: BaseDialogStub,
          Icon: true
        }
      }
    })

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('地区服务条款')
  })
})
