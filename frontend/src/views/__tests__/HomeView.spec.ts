import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'

const checkAuth = vi.fn()
const fetchPublicSettings = vi.fn()
const { getHomepageStatus, refreshHomeParallax } = vi.hoisted(() => ({
  getHomepageStatus: vi.fn(),
  refreshHomeParallax: vi.fn(),
}))

const authState = {
  isAuthenticated: false,
  isAdmin: false,
  checkAuth,
}

const appState = reactive({
  cachedPublicSettings: null as null | Record<string, unknown>,
  siteName: 'Sub2API',
  siteLogo: '',
  apiBaseUrl: '',
  docUrl: 'https://docs.example.com',
  publicSettingsLoaded: true,
  fetchPublicSettings,
})

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

vi.mock('@/stores/app', () => ({
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

vi.mock('@/components/home/GatewayField.vue', () => ({
  default: defineComponent({
    name: 'GatewayFieldStub',
    methods: {
      setScrollProgress() {},
    },
    template: '<canvas class="gateway-field-stub" />',
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

vi.mock('@/api/homepageStatus', () => ({
  getHomepageStatus,
}))

vi.mock('@/composables/useHomeParallax', () => ({
  useHomeParallax: () => ({ refresh: refreshHomeParallax }),
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
    document.documentElement.classList.remove('dark')
    checkAuth.mockReset()
    fetchPublicSettings.mockReset()
    fetchPublicSettings.mockResolvedValue(undefined)
    getHomepageStatus.mockReset()
    refreshHomeParallax.mockReset()
    getHomepageStatus.mockResolvedValue({
      enabled: false,
      groups: [],
      monitors: [],
    })
    appState.cachedPublicSettings = null
    appState.siteName = 'Sub2API'
    appState.siteLogo = ''
    appState.apiBaseUrl = ''
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

  it('renders the Geist-style product fallback shell', async () => {
    const wrapper = mount(HomeView)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Sub2API')
    expect(wrapper.text()).toContain('home.heroDescription')
    expect(wrapper.text()).toContain('home.features.unifiedGateway')
    expect(wrapper.text()).toContain('home.landing.sections.overview')
    expect(wrapper.text()).toContain('home.providers.claude')
    expect(wrapper.find('.geist-home').exists()).toBe(true)
    expect(wrapper.find('.home-topnav').exists()).toBe(true)
    expect(wrapper.find('.gateway-field-stub').exists()).toBe(true)
    expect(wrapper.find('.home-hero-title').text()).toBe('Sub2API')
    expect(wrapper.find('.home-hero-overline').text()).toContain('UNIFIED AI GATEWAY')
    expect(wrapper.find('.home-lunar-meta').text()).toContain('NASA LRO')
    expect(wrapper.find('.home-node-label').exists()).toBe(false)
    expect(wrapper.find('.home-request-rail').exists()).toBe(true)
    expect(wrapper.find('.home-terminal-cta').exists()).toBe(true)
    expect(wrapper.find('.home-terminal-cta a').attributes('href')).toBe('/login')
  })

  it('keeps auth destination and recharge CTA stable', async () => {
    const wrapper = mount(HomeView)
    await flushPromises()

    const links = wrapper.findAll('a')
    expect(links.some((link) => link.attributes('href') === '/login')).toBe(true)
    expect(links.some((link) => link.attributes('href') === 'https://z30.top/purchase')).toBe(true)
    expect(links.some((link) => link.attributes('href') === 'https://docs.example.com/')).toBe(true)
  })

  it('shows model plaza entries in the top navigation and hero when enabled', async () => {
    appState.cachedPublicSettings = { model_plaza_enabled: true }

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('.home-model-plaza-nav').attributes('href')).toBe('/model-plaza')
    expect(wrapper.find('.home-model-plaza-cta').attributes('href')).toBe('/model-plaza')
    expect(wrapper.findAll('a[href="/model-plaza"]')).toHaveLength(2)
  })

  it('hides model plaza entries when the feature is disabled', async () => {
    appState.cachedPublicSettings = { model_plaza_enabled: false }

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('a[href="/model-plaza"]').exists()).toBe(false)
  })

  it('hides model plaza entries from anonymous visitors when sign-in is required', async () => {
    appState.cachedPublicSettings = {
      model_plaza_enabled: true,
      model_plaza_require_auth: true,
    }

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('a[href="/model-plaza"]').exists()).toBe(false)
  })

  it('shows model plaza entries to authenticated visitors when sign-in is required', async () => {
    authState.isAuthenticated = true
    appState.cachedPublicSettings = {
      model_plaza_enabled: true,
      model_plaza_require_auth: true,
    }

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('.home-model-plaza-nav').attributes('href')).toBe('/model-plaza')
    expect(wrapper.find('.home-model-plaza-cta').attributes('href')).toBe('/model-plaza')
  })

  it('routes authenticated users to the correct dashboard', async () => {
    authState.isAuthenticated = true
    authState.isAdmin = true

    const wrapper = mount(HomeView)
    await flushPromises()

    const links = wrapper.findAll('a')
    expect(links.some((link) => link.attributes('href') === '/admin/dashboard')).toBe(true)
  })

  it('uses the permanent dark landing shell and renders the Apollo archive', async () => {
    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('button[title="home.switchToDark"]').exists()).toBe(false)
    expect(wrapper.find('.home-mission-archive').exists()).toBe(true)
    expect(wrapper.find('img[src="/assets/home/apollo-17-astronaut.jpg"]').exists()).toBe(true)
    expect(wrapper.find('img[src="/assets/home/apollo-17-lunar-rover.jpg"]').exists()).toBe(true)
  })

  it('uses public settings for branding and API base URL', async () => {
    appState.cachedPublicSettings = {
      site_name: 'Custom API',
      site_subtitle: 'Custom gateway subtitle',
      api_base_url: 'https://api.example.com/v1',
      doc_url: 'https://docs.custom.test',
      home_content: '',
      custom_endpoints: [{ name: 'Internal', endpoint: '/internal', description: '' }],
    }

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.text()).toContain('Custom API')
    expect(wrapper.text()).toContain('Custom gateway subtitle')
    expect(wrapper.text()).toContain('https://api.example.com/v1')
    expect(wrapper.text()).toContain('home.providers.more +1')
    expect(wrapper.text()).toContain('Internal')
    expect(wrapper.find('.geist-home').exists()).toBe(true)
  })

  it('renders configured group rates and enabled channel uptime', async () => {
    getHomepageStatus.mockResolvedValueOnce({
      enabled: true,
      groups: [
        { id: 7, name: 'Premium', platform: 'openai', rate_multiplier: 1.25 },
      ],
      monitors: [
        {
          id: 12,
          name: 'Primary OpenAI',
          provider: 'openai',
          status: 'operational',
          uptime_7d: 99.456,
        },
        {
          id: 13,
          name: 'New Channel',
          provider: 'anthropic',
          status: 'unknown',
          uptime_7d: null,
        },
      ],
    })

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(getHomepageStatus).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="homepage-status-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="homepage-status-group-7"]').text()).toContain('Premium')
    expect(wrapper.find('[data-testid="homepage-status-group-7"]').text()).toContain('1.25x')

    const operationalMonitor = wrapper.find('[data-testid="homepage-status-monitor-12"]')
    expect(operationalMonitor.text()).toContain('Primary OpenAI')
    expect(operationalMonitor.text()).toContain('monitorCommon.status.operational')
    expect(operationalMonitor.text()).toContain('99.46%')
    expect(operationalMonitor.find('.is-operational').exists()).toBe(true)
    expect(wrapper.find('[data-testid="homepage-status-monitor-13"]').text()).toContain('--')
    expect(refreshHomeParallax).toHaveBeenCalledTimes(1)
  })

  it.each([
    { name: 'disabled', enabled: false, groups: [{ id: 1, name: 'Hidden', platform: 'openai', rate_multiplier: 1 }], monitors: [] },
    { name: 'empty', enabled: true, groups: [], monitors: [] },
  ])('does not render the homepage status section when the response is $name', async (response) => {
    getHomepageStatus.mockResolvedValueOnce(response)

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('[data-testid="homepage-status-section"]').exists()).toBe(false)
  })

  it('keeps the product homepage usable when the status request fails', async () => {
    getHomepageStatus.mockRejectedValueOnce(new Error('status unavailable'))

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(getHomepageStatus).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.geist-home').exists()).toBe(true)
    expect(wrapper.find('[data-testid="homepage-status-section"]').exists()).toBe(false)
    expect(refreshHomeParallax).not.toHaveBeenCalled()
  })

  it('aborts an in-flight status request when the homepage unmounts', async () => {
    let requestSignal: AbortSignal | undefined
    getHomepageStatus.mockImplementationOnce(({ signal }: { signal?: AbortSignal }) => {
      requestSignal = signal
      return new Promise(() => {})
    })

    const wrapper = mount(HomeView)
    await nextTick()

    expect(requestSignal?.aborted).toBe(false)
    wrapper.unmount()
    expect(requestSignal?.aborted).toBe(true)
  })

  it('renders custom home_content without the shell', async () => {
    appState.cachedPublicSettings = {
      home_content: '<p class="custom-home">Custom content</p>',
    }

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(wrapper.find('.geist-home').exists()).toBe(false)
    expect(wrapper.find('.home-topbar').exists()).toBe(false)
    expect(wrapper.find('.custom-home').exists()).toBe(true)
    expect(getHomepageStatus).not.toHaveBeenCalled()
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
    expect(wrapper.find('.geist-home').exists()).toBe(false)
    expect(getHomepageStatus).not.toHaveBeenCalled()
  })

  it('waits for public settings and skips status loading when they provide custom content', async () => {
    appState.publicSettingsLoaded = false
    fetchPublicSettings.mockImplementationOnce(async () => {
      appState.cachedPublicSettings = {
        home_content: '<p class="loaded-custom-home">Loaded custom content</p>',
      }
      appState.publicSettingsLoaded = true
    })

    const wrapper = mount(HomeView)
    await flushPromises()

    expect(fetchPublicSettings).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.loaded-custom-home').exists()).toBe(true)
    expect(getHomepageStatus).not.toHaveBeenCalled()
  })
})
