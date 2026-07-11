import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { UserAnnouncement } from '@/types'
import { useAnnouncementStore } from '@/stores/announcements'
import AnnouncementPopup from '../AnnouncementPopup.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/utils/format', () => ({
  formatRelativeWithDateTime: () => 'just now',
}))

const popup = {
  id: 1,
  title: 'Maintenance',
  content: 'Scheduled maintenance',
  created_at: new Date().toISOString(),
  notify_mode: 'popup',
  comments_enabled: false,
} as UserAnnouncement

describe('AnnouncementPopup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.body.style.overflow = 'auto'
  })

  afterEach(() => {
    document.body.style.overflow = ''
    document.body.innerHTML = ''
  })

  it('restores the previous body overflow after the popup closes', async () => {
    const store = useAnnouncementStore()
    const wrapper = mount(AnnouncementPopup, { attachTo: document.body })

    store.currentPopup = popup
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    store.currentPopup = null
    await nextTick()
    expect(document.body.style.overflow).toBe('auto')

    wrapper.unmount()
  })

  it('restores the previous body overflow when unmounted while open', async () => {
    const store = useAnnouncementStore()
    const wrapper = mount(AnnouncementPopup, { attachTo: document.body })

    store.currentPopup = popup
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('auto')
  })
})
