import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

const checkAuth = vi.fn()
const fetchPublicSettings = vi.fn()

const authState = {
  isAuthenticated: false,
  isAdmin: false,
  checkAuth,
}

const appState = {
  cachedPublicSettings: null as null | Record<string, unknown>,
  siteName: 'Sub2API',
  siteLogo: '',
  docUrl: 'https://docs.example.com',
  publicSettingsLoaded: true,
  fetchPublicSettings,
}

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: { value: 'en' },
    }),
  }
})

vi.mock('@/stores', () => ({
  useAuthStore: () => authState,
  useAppStore: () => appState,
}))

vi.mock('@/components/common/LocaleSwitcher.vue', () => ({
  default: defineComponent({
    name: 'LocaleSwitcherStub',
    template: '<button class="locale-switcher-stub">locale</button>',
  }),
}))

vi.mock('@/components/icons/Icon.vue', () => ({
  default: defineComponent({
    name: 'IconStub',
    props: ['name'],
    template: '<span class="icon-stub" />',
  }),
}))

vi.mock('@/api/setup', () => ({
  getSetupStatus: vi.fn(),
}))

vi.mock('@/router/title', () => ({
  resolveRouteDocumentTitle: vi.fn(),
}))

vi.mock('@/router/setupRedirect', () => ({
  resolveCompletedSetupRedirectPath: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  getPublicSettings: vi.fn(),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    RouterLink: defineComponent({
      name: 'RouterLinkStub',
      props: {
        to: { type: [String, Object], required: true },
      },
      template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
    }),
  }
})

import HomeView from '../HomeView.vue'

describe('HomeView', () => {
  beforeEach(() => {
    checkAuth.mockReset()
    fetchPublicSettings.mockReset()
    appState.cachedPublicSettings = null
    appState.siteName = 'Sub2API'
    appState.siteLogo = ''
    appState.docUrl = 'https://docs.example.com'
    appState.publicSettingsLoaded = true
    authState.isAuthenticated = false
    authState.isAdmin = false
    localStorage.clear()

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  it('renders the Geist-style fallback shell', async () => {
    const wrapper = mount(HomeView)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('home.landing.heroSubtitle')
    expect(wrapper.text()).toContain('home.landing.sections.overview')
    expect(wrapper.find('.geist-home').exists()).toBe(true)
    expect(wrapper.find('.home-content-shell').exists()).toBe(false)
  })

  it('keeps auth destination and recharge CTA stable', async () => {
    const wrapper = mount(HomeView)
    await flushPromises()

    const links = wrapper.findAll('a')
    expect(links.some((link) => link.attributes('href') === '/login')).toBe(true)
    expect(links.some((link) => link.attributes('href') === 'https://catfk.com/shop/Z30AI')).toBe(true)
  })

  it('toggles theme and persists selection', async () => {
    const wrapper = mount(HomeView)
    await flushPromises()

    await wrapper.find('button[title="home.switchToDark"]').trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('renders custom home_content without the shell', async () => {
    appState.cachedPublicSettings = {
      home_content: '<p class="custom-home">Custom content</p>',
    }

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('.geist-home').exists()).toBe(false)
    expect(wrapper.find('.custom-home').exists()).toBe(true)
  })

  it('renders home_content URLs as iframe content', async () => {
    appState.cachedPublicSettings = {
      home_content: 'https://example.com/embed',
    }

    const wrapper = mount(HomeView)
    await flushPromises()

    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toBe('https://example.com/embed')
  })
})
