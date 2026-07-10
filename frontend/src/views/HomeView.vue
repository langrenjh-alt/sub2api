<template>
  <iframe
    v-if="isHomeContentUrl"
    :src="trimmedHomeContent"
    class="h-screen w-full border-0"
    allowfullscreen
  ></iframe>

  <div v-else-if="trimmedHomeContent" v-html="homeContent"></div>

  <div v-else class="geist-home min-h-screen">
    <header class="home-topbar">
      <div class="home-shell home-topbar-inner">
        <RouterLink to="/home" class="home-brand" aria-label="Home">
          <span class="home-brand-mark">
            <img :src="siteLogo || '/logo.png'" alt="" class="h-full w-full object-contain" />
          </span>
          <span class="home-brand-copy">
            <strong>{{ brandName }}</strong>
            <span>{{ siteTagline }}</span>
          </span>
        </RouterLink>

        <nav class="home-topnav" aria-label="Primary">
          <a href="#capabilities">{{ t('home.landing.sections.overview') }}</a>
          <a href="#compatibility">{{ t('home.landing.sections.compatibility') }}</a>
          <a href="#access">{{ t('home.landing.sections.accessSteps') }}</a>
        </nav>

        <div class="home-topbar-actions">
          <LocaleSwitcher />
          <button
            class="geist-icon-button"
            type="button"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="sm" />
            <Icon v-else name="moon" size="sm" />
          </button>
          <RouterLink :to="workspacePath" class="geist-button geist-button-primary home-auth-link">
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
            <Icon name="arrowRight" size="sm" />
          </RouterLink>
        </div>
      </div>
    </header>

    <main class="home-shell home-main">
      <section class="home-hero" aria-labelledby="home-title">
        <div class="home-hero-copy">
          <p class="home-kicker">{{ t('home.tags.subscriptionToApi') }}</p>
          <h1 id="home-title">{{ brandName }}</h1>
          <p class="home-lead">{{ heroDescription }}</p>

          <div class="home-hero-actions">
            <RouterLink :to="workspacePath" class="geist-button geist-button-primary">
              {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
              <Icon name="arrowRight" size="sm" />
            </RouterLink>
            <a
              :href="rechargeUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="geist-button geist-button-secondary"
            >
              {{ t('home.landing.actions.rechargeNow') }}
              <Icon name="externalLink" size="sm" />
            </a>
          </div>
        </div>

        <div class="home-hero-panel" aria-label="Gateway summary">
          <div class="home-panel-header">
            <span>Gateway</span>
            <span>{{ t('home.landing.providerStatus.ready') }}</span>
          </div>
          <div class="home-endpoint-row">
            <span>Base URL</span>
            <strong>{{ baseUrl }}</strong>
          </div>
          <div class="home-status-grid">
            <div v-for="metric in heroMetrics" :key="metric.label" class="home-status-cell">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
        </div>
      </section>

      <div class="home-mobile-nav" aria-label="Sections">
        <a href="#actions">{{ t('home.landing.sections.quickActions') }}</a>
        <a href="#capabilities">{{ t('home.landing.sections.overview') }}</a>
        <a href="#compatibility">{{ t('home.landing.sections.compatibility') }}</a>
        <a href="#access">{{ t('home.landing.sections.accessSteps') }}</a>
      </div>

      <section id="actions" class="home-section">
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.quickActions') }}</p>
          <h2>{{ t('home.landing.workflowTitle') }}</h2>
        </div>

        <div class="home-action-grid">
          <RouterLink
            v-for="action in primaryActions"
            :key="action.label"
            :to="action.to"
            class="home-action"
          >
            <span class="home-action-icon">
              <Icon :name="action.icon" size="sm" />
            </span>
            <span>
              <strong>{{ action.label }}</strong>
              <small>{{ action.detail }}</small>
            </span>
          </RouterLink>

          <a
            v-for="action in externalActions"
            :key="action.label"
            :href="action.href"
            :target="action.external ? '_blank' : undefined"
            :rel="action.external ? 'noopener noreferrer' : undefined"
            class="home-action"
          >
            <span class="home-action-icon">
              <Icon :name="action.icon" size="sm" />
            </span>
            <span>
              <strong>{{ action.label }}</strong>
              <small>{{ action.detail }}</small>
            </span>
          </a>
        </div>
      </section>

      <section id="capabilities" class="home-section">
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.overview') }}</p>
          <h2>{{ t('home.solutions.title') }}</h2>
        </div>

        <div class="home-product-grid">
          <article v-for="feature in productFeatures" :key="feature.title" class="geist-card">
            <div class="home-card-icon">
              <Icon :name="feature.icon" size="sm" />
            </div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </article>
        </div>
      </section>

      <section id="compatibility" class="home-section home-two-column">
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.compatibility') }}</p>
          <h2>{{ t('home.providers.description') }}</h2>
          <p>{{ t('home.landing.modelsTitle') }}</p>
        </div>

        <div class="home-provider-list">
          <article v-for="provider in providers" :key="provider.name" class="home-provider-row">
            <div>
              <strong>{{ provider.name }}</strong>
              <span>{{ provider.detail }}</span>
            </div>
            <small :class="{ 'is-muted': provider.status !== t('home.providers.supported') }">
              {{ provider.status }}
            </small>
          </article>
        </div>
      </section>

      <section id="access" class="home-section home-two-column">
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.accessSteps') }}</p>
          <h2>{{ t('home.landing.accessTitle') }}</h2>
          <p>{{ t('home.landing.accessDescription') }}</p>
        </div>

        <div class="home-steps">
          <article v-for="step in accessSteps" :key="step.index" class="home-step">
            <span>{{ step.index }}</span>
            <div>
              <strong>{{ step.title }}</strong>
              <p>{{ step.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="home-section">
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.status') }}</p>
          <h2>{{ t('common.status') }}</h2>
        </div>

        <div class="home-status-list">
          <article v-for="item in statusItems" :key="item.label" class="home-status-row">
            <div>
              <strong>{{ item.label }}</strong>
              <span>{{ item.detail }}</span>
            </div>
            <small :class="{ 'is-active': item.active }">
              {{ item.active ? t('common.enabled') : t('common.disabled') }}
            </small>
          </article>
        </div>
      </section>
    </main>

    <footer class="home-shell home-footer">
      <p>&copy; {{ currentYear }} {{ brandName }}</p>
      <div>
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">
          {{ t('home.docs') }}
        </a>
        <RouterLink to="/key-usage">{{ t('keyUsage.title') }}</RouterLink>
        <a :href="rechargeUrl" target="_blank" rel="noopener noreferrer">
          {{ t('home.landing.nav.recharge') }}
        </a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'

type IconName = InstanceType<typeof Icon>['$props']['name']

interface ActionLink {
  label: string
  detail: string
  icon: IconName
}

interface RouterActionLink extends ActionLink {
  to: string
}

interface ExternalActionLink extends ActionLink {
  href: string
  external?: boolean
}

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const trimmedHomeContent = computed(() => homeContent.value.trim())
const isHomeContentUrl = computed(
  () => trimmedHomeContent.value.startsWith('http://') || trimmedHomeContent.value.startsWith('https://')
)

const siteLogo = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', {
    allowRelative: true,
    allowDataUrl: true,
  })
)
const brandName = computed(
  () => appStore.cachedPublicSettings?.site_name?.trim() || appStore.siteName?.trim() || 'Sub2API'
)
const siteTagline = computed(
  () => appStore.cachedPublicSettings?.site_subtitle?.trim() || t('home.heroSubtitle')
)
const heroDescription = computed(
  () => appStore.cachedPublicSettings?.site_subtitle?.trim() || t('home.heroDescription')
)
const docUrl = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
)
const apiBaseUrl = computed(() => appStore.cachedPublicSettings?.api_base_url || appStore.apiBaseUrl || '')
const customEndpoints = computed(() => appStore.cachedPublicSettings?.custom_endpoints ?? [])

const rechargeUrl = 'https://catfk.com/shop/Z30AI'
const baseUrl = computed(() => {
  const configured = apiBaseUrl.value.trim()
  if (configured) return configured
  return `${window.location.origin}/v1`
})

const isDark = ref(document.documentElement.classList.contains('dark'))
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const workspacePath = computed(() => (isAuthenticated.value ? (isAdmin.value ? '/admin/dashboard' : '/dashboard') : '/login'))
const currentYear = computed(() => new Date().getFullYear())

const heroMetrics = computed(() => [
  { label: t('home.landing.metrics.gateway'), value: t('home.landing.providerStatus.ready') },
  { label: t('home.landing.metrics.billing'), value: t('home.tags.realtimeBilling') },
  { label: t('home.landing.metrics.baseUrl'), value: '/v1' },
])

const primaryActions = computed<RouterActionLink[]>(() => [
  {
    label: isAuthenticated.value ? t('home.landing.actions.openWorkspace') : t('home.getStarted'),
    detail: isAuthenticated.value ? t('home.dashboard') : t('home.login'),
    to: workspacePath.value,
    icon: 'grid',
  },
  {
    label: t('keyUsage.title'),
    detail: t('keyUsage.subtitle'),
    to: '/key-usage',
    icon: 'search',
  },
])

const externalActions = computed<ExternalActionLink[]>(() => {
  const actions: ExternalActionLink[] = [
    {
      label: t('home.landing.actions.rechargeNow'),
      detail: t('home.landing.actions.rechargeEntry'),
      href: rechargeUrl,
      icon: 'creditCard',
      external: true,
    },
  ]

  if (docUrl.value) {
    actions.push({
      label: t('home.docs'),
      detail: t('home.viewDocs'),
      href: docUrl.value,
      icon: 'book',
      external: true,
    })
  }

  return actions
})

const productFeatures = computed(() => [
  {
    title: t('home.features.unifiedGateway'),
    description: t('home.features.unifiedGatewayDesc'),
    icon: 'server' as IconName,
  },
  {
    title: t('home.features.multiAccount'),
    description: t('home.features.multiAccountDesc'),
    icon: 'sync' as IconName,
  },
  {
    title: t('home.features.balanceQuota'),
    description: t('home.features.balanceQuotaDesc'),
    icon: 'chart' as IconName,
  },
])

const providers = computed(() => [
  {
    name: t('home.providers.claude'),
    detail: t('home.landing.providerCaptions.claude'),
    status: t('home.providers.supported'),
  },
  {
    name: 'GPT',
    detail: t('home.landing.providerCaptions.gpt'),
    status: t('home.providers.supported'),
  },
  {
    name: t('home.providers.gemini'),
    detail: t('home.landing.providerCaptions.gemini'),
    status: t('home.providers.supported'),
  },
  {
    name: t('home.providers.antigravity'),
    detail: t('home.landing.providerCaptions.antigravity'),
    status: t('home.providers.supported'),
  },
  {
    name: customEndpoints.value.length > 0 ? `${t('home.providers.more')} +${customEndpoints.value.length}` : t('home.providers.more'),
    detail: customEndpoints.value.length > 0 ? customEndpoints.value.map((item) => item.name).join(' / ') : t('home.landing.providerCaptions.more'),
    status: customEndpoints.value.length > 0 ? t('home.providers.supported') : t('home.providers.soon'),
  },
])

const accessSteps = computed(() => [
  {
    index: '01',
    title: t('home.landing.accessSteps.connect.title'),
    description: t('home.landing.accessSteps.connect.description'),
  },
  {
    index: '02',
    title: t('home.landing.accessSteps.key.title'),
    description: t('home.landing.accessSteps.key.description'),
  },
  {
    index: '03',
    title: t('home.landing.accessSteps.client.title'),
    description: t('home.landing.accessSteps.client.description'),
  },
])

const statusItems = computed(() => [
  {
    label: t('nav.buySubscription'),
    detail: t('home.landing.actions.rechargeEntry'),
    active: appStore.cachedPublicSettings?.payment_enabled === true,
  },
  {
    label: t('nav.channelMonitor'),
    detail: t('home.landing.metrics.gateway'),
    active: appStore.cachedPublicSettings?.channel_monitor_enabled !== false,
  },
  {
    label: t('nav.availableChannels'),
    detail: t('home.landing.sections.compatibility'),
    active: appStore.cachedPublicSettings?.available_channels_enabled === true,
  },
  {
    label: t('nav.tickets'),
    detail: t('common.contactSupport'),
    active: appStore.cachedPublicSettings?.ticket_system_enabled === true,
  },
])

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme')
  if (
    savedTheme === 'dark' ||
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
}

onMounted(() => {
  initTheme()
  authStore.checkAuth()

  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
})
</script>

<style scoped>
.geist-home {
  color: #111111;
  background:
    linear-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.035) 1px, transparent 1px),
    #fafafa;
  background-size: 48px 48px;
  font-family:
    Inter,
    "SF Pro Display",
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

:global(.dark .geist-home) {
  color: #f5f5f5;
  background:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    #090909;
  background-size: 48px 48px;
}

.home-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
}

.home-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(250, 250, 250, 0.86);
  backdrop-filter: blur(16px);
}

:global(.dark .home-topbar) {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(9, 9, 9, 0.82);
}

.home-topbar-inner {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.home-brand {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: inherit;
}

.home-brand-mark {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: #ffffff;
}

:global(.dark .home-brand-mark) {
  border-color: rgba(255, 255, 255, 0.12);
  background: #111111;
}

.home-brand-copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.home-brand-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: 0;
}

.home-brand-copy span {
  overflow: hidden;
  max-width: 260px;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.55);
  font-size: 12px;
  line-height: 1.2;
}

:global(.dark .home-brand-copy span) {
  color: rgba(255, 255, 255, 0.56);
}

.home-topnav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.62);
}

:global(.dark .home-topnav) {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.035);
}

.home-topnav a {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  color: rgba(0, 0, 0, 0.66);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
}

.home-topnav a:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #111111;
}

:global(.dark .home-topnav a) {
  color: rgba(255, 255, 255, 0.68);
}

:global(.dark .home-topnav a:hover) {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.home-topbar-actions,
.home-hero-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.geist-button,
.geist-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  border-radius: 6px;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.geist-button {
  min-height: 36px;
  padding: 0 13px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 560;
}

.geist-icon-button {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #ffffff;
  color: #111111;
}

.geist-button-primary {
  background: #111111;
  color: #ffffff;
}

.geist-button-secondary {
  border-color: rgba(0, 0, 0, 0.12);
  background: #ffffff;
  color: #111111;
}

.geist-button:hover,
.geist-icon-button:hover {
  transform: translateY(-1px);
}

.geist-button-primary:hover {
  background: #2b2b2b;
}

.geist-button-secondary:hover,
.geist-icon-button:hover {
  border-color: rgba(0, 0, 0, 0.25);
}

:global(.dark .geist-icon-button),
:global(.dark .geist-button-secondary) {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: #f5f5f5;
}

:global(.dark .geist-button-primary) {
  background: #f5f5f5;
  color: #111111;
}

:global(.dark .geist-button-primary:hover) {
  background: #dedede;
}

:global(.dark .geist-button-secondary:hover),
:global(.dark .geist-icon-button:hover) {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
}

.home-main {
  display: grid;
  gap: 36px;
  padding: 58px 0 46px;
}

.home-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.04fr) minmax(360px, 0.76fr);
  gap: 24px;
  align-items: stretch;
}

.home-hero-copy {
  display: flex;
  min-height: 360px;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  padding: 28px 0;
}

.home-kicker {
  margin: 0;
  color: rgba(0, 0, 0, 0.54);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:global(.dark .home-kicker) {
  color: rgba(255, 255, 255, 0.54);
}

.home-hero h1 {
  margin: 0;
  max-width: 780px;
  font-size: clamp(44px, 7vw, 86px);
  font-weight: 720;
  line-height: 0.96;
  letter-spacing: 0;
}

.home-lead {
  margin: 0;
  max-width: 680px;
  color: rgba(0, 0, 0, 0.64);
  font-size: clamp(16px, 1.55vw, 20px);
  line-height: 1.62;
}

:global(.dark .home-lead) {
  color: rgba(255, 255, 255, 0.66);
}

.home-hero-panel,
.geist-card,
.home-provider-row,
.home-step,
.home-status-row,
.home-action {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
}

:global(.dark .home-hero-panel),
:global(.dark .geist-card),
:global(.dark .home-provider-row),
:global(.dark .home-step),
:global(.dark .home-status-row),
:global(.dark .home-action) {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.045);
}

.home-hero-panel {
  display: grid;
  align-content: space-between;
  min-height: 360px;
  padding: 18px;
}

.home-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(0, 0, 0, 0.52);
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  text-transform: uppercase;
}

:global(.dark .home-panel-header) {
  color: rgba(255, 255, 255, 0.56);
}

.home-endpoint-row {
  display: grid;
  gap: 8px;
  padding: 30px 0;
}

.home-endpoint-row span {
  color: rgba(0, 0, 0, 0.54);
  font-size: 13px;
}

.home-endpoint-row strong {
  overflow-wrap: anywhere;
  font-family:
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    Menlo,
    monospace;
  font-size: clamp(18px, 2vw, 26px);
  font-weight: 620;
  line-height: 1.22;
}

:global(.dark .home-endpoint-row span) {
  color: rgba(255, 255, 255, 0.56);
}

.home-status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

:global(.dark .home-status-grid) {
  border-color: rgba(255, 255, 255, 0.1);
}

.home-status-cell {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.home-status-cell:last-child {
  border-right: 0;
}

:global(.dark .home-status-cell) {
  border-right-color: rgba(255, 255, 255, 0.1);
}

.home-status-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.54);
  font-size: 12px;
}

.home-status-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 650;
}

:global(.dark .home-status-cell span) {
  color: rgba(255, 255, 255, 0.56);
}

.home-mobile-nav {
  display: none;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.home-mobile-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  flex: 0 0 auto;
  padding: 0 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  color: rgba(0, 0, 0, 0.68);
  font-size: 12px;
  font-weight: 560;
}

:global(.dark .home-mobile-nav a) {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
}

.home-section {
  display: grid;
  gap: 18px;
  scroll-margin-top: 90px;
}

.home-section-heading {
  display: grid;
  gap: 8px;
  max-width: 680px;
}

.home-section-heading h2 {
  margin: 0;
  font-size: clamp(24px, 3vw, 36px);
  font-weight: 690;
  line-height: 1.08;
  letter-spacing: 0;
}

.home-section-heading p:not(.home-kicker) {
  margin: 0;
  color: rgba(0, 0, 0, 0.6);
  font-size: 14px;
  line-height: 1.62;
}

:global(.dark .home-section-heading p:not(.home-kicker)) {
  color: rgba(255, 255, 255, 0.62);
}

.home-action-grid,
.home-product-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.home-action {
  min-width: 0;
  display: flex;
  gap: 12px;
  min-height: 92px;
  padding: 14px;
  color: inherit;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.home-action:hover,
.geist-card:hover,
.home-provider-row:hover,
.home-step:hover,
.home-status-row:hover {
  border-color: rgba(0, 0, 0, 0.24);
  transform: translateY(-1px);
}

:global(.dark .home-action:hover),
:global(.dark .geist-card:hover),
:global(.dark .home-provider-row:hover),
:global(.dark .home-step:hover),
:global(.dark .home-status-row:hover) {
  border-color: rgba(255, 255, 255, 0.28);
}

.home-action-icon,
.home-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.035);
}

:global(.dark .home-action-icon),
:global(.dark .home-card-icon) {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
}

.home-action span:last-child {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.home-action strong,
.home-provider-row strong,
.home-step strong,
.home-status-row strong,
.geist-card h3 {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: 0;
}

.home-action small,
.home-provider-row span,
.home-step p,
.home-status-row span,
.geist-card p {
  margin: 0;
  color: rgba(0, 0, 0, 0.58);
  font-size: 13px;
  line-height: 1.5;
}

:global(.dark .home-action small),
:global(.dark .home-provider-row span),
:global(.dark .home-step p),
:global(.dark .home-status-row span),
:global(.dark .geist-card p) {
  color: rgba(255, 255, 255, 0.6);
}

.geist-card {
  min-height: 184px;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.geist-card h3 {
  margin: 0;
}

.home-two-column {
  grid-template-columns: minmax(260px, 0.68fr) minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}

.home-provider-list,
.home-steps,
.home-status-list {
  display: grid;
  gap: 8px;
}

.home-provider-row,
.home-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 66px;
  padding: 13px 14px;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.home-provider-row > div,
.home-status-row > div {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.home-provider-row small,
.home-status-row small {
  flex: 0 0 auto;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  padding: 4px 8px;
  color: rgba(0, 0, 0, 0.66);
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  text-transform: uppercase;
}

.home-provider-row small.is-muted {
  color: rgba(0, 0, 0, 0.42);
}

.home-status-row small.is-active {
  border-color: rgba(16, 185, 129, 0.34);
  color: #047857;
}

:global(.dark .home-provider-row small),
:global(.dark .home-status-row small) {
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.68);
}

:global(.dark .home-provider-row small.is-muted) {
  color: rgba(255, 255, 255, 0.42);
}

:global(.dark .home-status-row small.is-active) {
  border-color: rgba(52, 211, 153, 0.34);
  color: #6ee7b7;
}

.home-step {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  min-height: 92px;
  padding: 14px;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.home-step > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 7px;
  color: rgba(0, 0, 0, 0.58);
  font-size: 12px;
  font-weight: 650;
}

:global(.dark .home-step > span) {
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.62);
}

.home-step div {
  display: grid;
  gap: 5px;
}

.home-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 0 34px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.58);
  font-size: 13px;
}

:global(.dark .home-footer) {
  border-top-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.58);
}

.home-footer p {
  margin: 0;
}

.home-footer div {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 12px;
}

.home-footer a {
  color: inherit;
}

.home-footer a:hover {
  color: #111111;
}

:global(.dark .home-footer a:hover) {
  color: #ffffff;
}

@media (max-width: 960px) {
  .home-topnav {
    display: none;
  }

  .home-main {
    gap: 30px;
    padding-top: 38px;
  }

  .home-hero,
  .home-two-column {
    grid-template-columns: 1fr;
  }

  .home-hero-copy,
  .home-hero-panel {
    min-height: auto;
  }

  .home-mobile-nav {
    display: flex;
  }

  .home-action-grid,
  .home-product-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .home-shell {
    width: min(100% - 24px, 1120px);
  }

  .home-topbar-inner {
    min-height: 58px;
    gap: 10px;
  }

  .home-brand-copy span {
    display: none;
  }

  .home-auth-link {
    display: none;
  }

  .home-hero {
    gap: 14px;
  }

  .home-hero-copy {
    padding: 14px 0;
  }

  .home-hero-actions {
    flex-wrap: wrap;
  }

  .home-status-grid {
    grid-template-columns: 1fr;
  }

  .home-status-cell {
    border-right: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .home-status-cell:last-child {
    border-bottom: 0;
  }

  :global(.dark .home-status-cell) {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .home-provider-row,
  .home-status-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .home-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .geist-home *,
  .geist-home *::before,
  .geist-home *::after {
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
    animation-duration: 1ms !important;
  }

  .geist-button:hover,
  .geist-icon-button:hover,
  .home-action:hover,
  .geist-card:hover,
  .home-provider-row:hover,
  .home-step:hover,
  .home-status-row:hover {
    transform: none;
  }
}
</style>
