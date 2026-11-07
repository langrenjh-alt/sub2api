<template>
  <!-- Custom Home Content: Full Page Mode -->
  <div v-if="hasHomeContent" class="min-h-screen">
    <!-- iframe mode -->
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      :title="brandName"
      allowfullscreen
    ></iframe>
    <!-- HTML mode - SECURITY: homeContent is admin-only setting, XSS risk is acceptable -->
    <div v-else v-html="homeContent"></div>
  </div>

  <!-- Compact Home Page -->
  <div
    v-else-if="compactHomeEnabled"
    data-testid="compact-home"
    class="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-dark-950 dark:text-white"
  >
    <header class="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-dark-800">
      <nav class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <img
            :src="siteLogo || '/logo.svg'"
            alt="Logo"
            class="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <span class="min-w-0 truncate text-base font-semibold">{{ brandName }}</span>
        </div>
        <div class="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          <LocaleSwitcher />
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800"
            :title="t('home.viewDocs')"
          >
            <Icon name="book" size="md" />
          </a>
          <router-link
            v-if="showModelPlazaEntry"
            to="/model-plaza"
            class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white"
            :title="t('nav.modelPlaza')"
          >
            <Icon name="grid" size="md" />
            <span class="hidden sm:inline">{{ t('nav.modelPlaza') }}</span>
          </router-link>
          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="md" />
            <Icon v-else name="moon" size="md" />
          </button>
          <router-link
            :to="workspacePath"
            class="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main class="flex min-w-0 flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div class="min-w-0 max-w-2xl text-center">
        <img
          :src="siteLogo || '/logo.svg'"
          alt="Logo"
          class="mx-auto mb-6 h-20 w-20 rounded-lg object-contain"
        />
        <h1 class="[overflow-wrap:anywhere] text-3xl font-bold md:text-4xl">{{ brandName }}</h1>
        <p class="mt-4 whitespace-pre-wrap [overflow-wrap:anywhere] text-base text-gray-600 dark:text-dark-300">{{ heroDescription }}</p>
        <router-link
          :to="workspacePath"
          class="mt-8 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
        </router-link>
      </div>
    </main>

    <footer class="min-w-0 border-t border-gray-200 px-4 py-5 text-center text-sm text-gray-500 [overflow-wrap:anywhere] sm:px-6 dark:border-dark-800 dark:text-dark-400">
      &copy; {{ currentYear }} {{ brandName }}
    </footer>
  </div>

  <div v-else class="z30-home terminal-container min-h-screen">
    <SignalHero
      :brand-name="brandName"
      :site-logo="siteLogo"
      :tagline="siteTagline"
      :workspace-path="workspacePath"
      :authenticated="isAuthenticated"
      :model-plaza="showModelPlazaEntry"
    />

    <section class="home-signal-strip" :aria-label="t('home.signal.index')">
      <div class="home-shell home-signal-grid">
        <div class="home-signal-cell home-signal-endpoint">
          <span>Base URL</span>
          <strong>{{ baseUrl }}</strong>
        </div>
        <div v-for="metric in heroMetrics" :key="metric.label" class="home-signal-cell">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>
    </section>

    <main class="home-main">
      <section id="actions" class="home-section home-shell">
        <div class="home-section-heading home-section-heading-row">
          <div>
            <p class="home-kicker">{{ t('home.landing.sections.quickActions') }}</p>
            <h2>{{ t('home.landing.workflowTitle') }}</h2>
          </div>
          <p>{{ t('home.landing.accessDescription') }}</p>
        </div>

        <div class="home-action-grid">
          <RouterLink v-if="showModelPlazaEntry" to="/model-plaza" class="home-action home-model-plaza-cta">
            <span class="home-action-icon"><Icon name="grid" size="sm" /></span>
            <span class="home-action-copy"><strong>{{ t('nav.modelPlaza') }}</strong></span>
            <Icon name="arrowRight" size="sm" class="home-action-arrow" />
          </RouterLink>
          <RouterLink
            v-for="action in primaryActions"
            :key="action.label"
            :to="action.to"
            class="home-action"
          >
            <span class="home-action-icon"><Icon :name="action.icon" size="sm" /></span>
            <span class="home-action-copy">
              <strong>{{ action.label }}</strong>
              <small>{{ action.detail }}</small>
            </span>
            <Icon name="arrowRight" size="sm" class="home-action-arrow" />
          </RouterLink>

          <a
            v-for="action in externalActions"
            :key="action.label"
            :href="action.href"
            :target="action.external ? '_blank' : undefined"
            :rel="action.external ? 'noopener noreferrer' : undefined"
            class="home-action"
          >
            <span class="home-action-icon"><Icon :name="action.icon" size="sm" /></span>
            <span class="home-action-copy">
              <strong>{{ action.label }}</strong>
              <small>{{ action.detail }}</small>
            </span>
            <Icon name="externalLink" size="sm" class="home-action-arrow" />
          </a>
        </div>
      </section>

      <section id="capabilities" class="home-section home-section-tint">
        <div class="home-shell home-feature-layout">
          <div class="home-section-heading home-feature-intro">
            <p class="home-kicker">{{ t('home.landing.sections.overview') }}</p>
            <h2>{{ t('home.solutions.title') }}</h2>
            <p>{{ t('home.heroDescription') }}</p>
          </div>

          <div class="home-product-grid">
            <article v-for="(feature, index) in productFeatures" :key="feature.title" class="home-feature">
              <div class="home-feature-meta">
                <span>0{{ index + 1 }}</span>
                <span class="home-action-icon"><Icon :name="feature.icon" size="sm" /></span>
              </div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="compatibility" class="home-section home-shell home-compatibility">
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.compatibility') }}</p>
          <h2>{{ t('home.landing.modelsTitle') }}</h2>
          <p>{{ t('home.providers.description') }}</p>
        </div>

        <div class="home-provider-list">
          <article v-for="provider in providers" :key="provider.name" class="home-provider-row">
            <div class="home-provider-name">
              <span class="home-provider-dot" aria-hidden="true"></span>
              <strong>{{ provider.name }}</strong>
            </div>
            <span>{{ provider.detail }}</span>
            <small :class="{ 'is-muted': provider.status !== t('home.providers.supported') }">
              {{ provider.status }}
            </small>
          </article>
        </div>
      </section>

      <section
        v-if="showHomepageStatus"
        id="homepage-status"
        class="home-section home-shell home-homepage-status"
        aria-labelledby="homepage-status-title"
        data-testid="homepage-status-section"
      >
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.ratesAndStatus') }}</p>
          <h2 id="homepage-status-title">{{ t('home.landing.homepageStatus.title') }}</h2>
          <p>{{ t('home.landing.homepageStatus.description') }}</p>
        </div>

        <div
          :class="[
            'home-homepage-status-grid',
            { 'is-single': homepageGroups.length === 0 || homepageMonitors.length === 0 },
          ]"
        >
          <div v-if="homepageGroups.length > 0" class="home-homepage-status-panel">
            <div class="home-homepage-status-label">
              <span>{{ t('home.landing.homepageStatus.groups') }}</span>
              <small>{{ homepageGroups.length.toString().padStart(2, '0') }}</small>
            </div>
            <div class="home-homepage-status-list">
              <article
                v-for="group in homepageGroups"
                :key="group.id"
                class="home-homepage-status-row home-homepage-group-row"
                :data-testid="`homepage-status-group-${group.id}`"
              >
                <span class="home-homepage-status-indicator is-operational" aria-hidden="true"></span>
                <div>
                  <strong>{{ group.name }}</strong>
                  <span>{{ group.platform }}</span>
                </div>
                <div class="home-homepage-status-value">
                  <small>{{ t('home.landing.homepageStatus.rate') }}</small>
                  <strong>{{ formatGroupRate(group.rate_multiplier) }}</strong>
                </div>
              </article>
            </div>
          </div>

          <div v-if="homepageMonitors.length > 0" class="home-homepage-status-panel">
            <div class="home-homepage-status-label">
              <span>{{ t('home.landing.homepageStatus.monitors') }}</span>
              <small>{{ homepageMonitors.length.toString().padStart(2, '0') }}</small>
            </div>
            <div class="home-homepage-status-list">
              <article
                v-for="monitor in homepageMonitors"
                :key="monitor.id"
                class="home-homepage-status-row"
                :data-testid="`homepage-status-monitor-${monitor.id}`"
              >
                <span
                  :class="['home-homepage-status-indicator', `is-${normalizeMonitorStatus(monitor.status)}`]"
                  aria-hidden="true"
                ></span>
                <div>
                  <strong>{{ monitor.name }}</strong>
                  <span>{{ monitor.provider }} / {{ monitorStatusLabel(monitor.status) }}</span>
                </div>
                <div class="home-homepage-status-value">
                  <small>{{ t('home.landing.homepageStatus.uptime7d') }}</small>
                  <strong>{{ formatMonitorUptime(monitor.uptime_7d) }}</strong>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="access" class="home-section home-section-dark">
        <div class="home-shell">
          <div class="home-section-heading home-section-heading-row">
            <div>
              <p class="home-kicker home-kicker-inverse">{{ t('home.landing.sections.accessSteps') }}</p>
              <h2>{{ t('home.landing.accessTitle') }}</h2>
            </div>
            <p>{{ t('home.landing.accessDescription') }}</p>
          </div>

          <div class="home-steps">
            <article v-for="step in accessSteps" :key="step.index" class="home-step">
              <span>{{ step.index }}</span>
              <strong>{{ step.title }}</strong>
              <p>{{ step.description }}</p>
            </article>
          </div>

          <div class="home-final-cta">
            <div>
              <span class="home-live-dot" aria-hidden="true"></span>
              <strong>{{ t('home.landing.providerStatus.ready') }}</strong>
              <small>{{ baseUrl }}</small>
            </div>
            <a
              :href="rechargeUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="home-button home-button-light"
            >
              {{ t('home.landing.actions.rechargeNow') }}
              <Icon name="externalLink" size="sm" />
            </a>
          </div>
        </div>
      </section>

      <section class="home-section home-shell home-status-section">
        <div class="home-section-heading">
          <p class="home-kicker">{{ t('home.landing.sections.status') }}</p>
          <h2>{{ t('common.status') }}</h2>
        </div>
        <div class="home-status-list">
          <article v-for="item in statusItems" :key="item.label" class="home-status-row">
            <span :class="['home-status-indicator', { 'is-active': item.active }]" aria-hidden="true"></span>
            <div>
              <strong>{{ item.label }}</strong>
              <span>{{ item.detail }}</span>
            </div>
            <small>{{ item.active ? t('common.enabled') : t('common.disabled') }}</small>
          </article>
        </div>
      </section>

      <section class="home-terminal-cta" aria-labelledby="terminal-cta-title">
        <div class="home-shell home-terminal-cta-inner">
          <div>
            <p class="home-kicker home-kicker-inverse">GATEWAY ACCESS</p>
            <h2 id="terminal-cta-title">{{ t('home.signal.enter') }}</h2>
            <p>{{ siteTagline }}</p>
          </div>
          <RouterLink :to="workspacePath" class="home-button home-button-light home-terminal-cta-action">
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
            <Icon name="arrowRight" size="sm" />
          </RouterLink>
        </div>
      </section>
    </main>

    <footer class="home-footer">
      <div class="home-shell home-footer-inner">
        <p>&copy; {{ currentYear }} {{ brandName }}</p>
        <div>
          <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }}</a>
          <RouterLink to="/key-usage">{{ t('keyUsage.title') }}</RouterLink>
          <a :href="rechargeUrl" target="_blank" rel="noopener noreferrer">{{ t('home.landing.nav.recharge') }}</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import SignalHero from '@/components/home/SignalHero.vue'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  getHomepageStatus,
  type HomepageStatusResponse,
} from '@/api/homepageStatus'
import { formatMultiplier } from '@/utils/formatters'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'

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
const homepageStatus = ref<HomepageStatusResponse | null>(null)

let homepageStatusController: AbortController | null = null

const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const trimmedHomeContent = computed(() => homeContent.value.trim())
const isHomeContentUrl = computed(
  () => trimmedHomeContent.value.startsWith('http://') || trimmedHomeContent.value.startsWith('https://')
)
const hasHomeContent = computed(() => homeContent.value.trim().length > 0)
const compactHomeEnabled = computed(() => appStore.cachedPublicSettings?.compact_home_enabled === true)

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
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const apiBaseUrl = computed(() => appStore.cachedPublicSettings?.api_base_url || appStore.apiBaseUrl || '')
const customEndpoints = computed(() => appStore.cachedPublicSettings?.custom_endpoints ?? [])
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))

const rechargeUrl = 'https://z30.top/purchase'
const baseUrl = computed(() => {
  const configured = apiBaseUrl.value.trim()
  if (configured) return configured
  return `${window.location.origin}/v1`
})

const isAuthenticated = computed(() => authStore.isAuthenticated)
const modelPlazaRequiresAuth = computed(
  () => appStore.cachedPublicSettings?.model_plaza_require_auth === true,
)
const showModelPlazaEntry = computed(
  () => modelPlazaEnabled.value && (isAuthenticated.value || !modelPlazaRequiresAuth.value),
)
const isAdmin = computed(() => authStore.isAdmin)
const workspacePath = computed(() =>
  isAuthenticated.value ? (isAdmin.value ? '/admin/dashboard' : '/dashboard') : '/login'
)
const currentYear = computed(() => new Date().getFullYear())
const isDark = ref(document.documentElement.classList.contains('dark'))
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

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
  { label: t('keyUsage.title'), detail: t('keyUsage.subtitle'), to: '/key-usage', icon: 'search' },
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
  { name: t('home.providers.claude'), detail: t('home.landing.providerCaptions.claude'), status: t('home.providers.supported') },
  { name: 'GPT', detail: t('home.landing.providerCaptions.gpt'), status: t('home.providers.supported') },
  { name: t('home.providers.gemini'), detail: t('home.landing.providerCaptions.gemini'), status: t('home.providers.supported') },
  { name: t('home.providers.antigravity'), detail: t('home.landing.providerCaptions.antigravity'), status: t('home.providers.supported') },
  {
    name: customEndpoints.value.length > 0 ? `${t('home.providers.more')} +${customEndpoints.value.length}` : t('home.providers.more'),
    detail: customEndpoints.value.length > 0
      ? customEndpoints.value.map((item) => item.name).join(' / ')
      : t('home.landing.providerCaptions.more'),
    status: customEndpoints.value.length > 0 ? t('home.providers.supported') : t('home.providers.soon'),
  },
])

const accessSteps = computed(() => [
  { index: '01', title: t('home.landing.accessSteps.connect.title'), description: t('home.landing.accessSteps.connect.description') },
  { index: '02', title: t('home.landing.accessSteps.key.title'), description: t('home.landing.accessSteps.key.description') },
  { index: '03', title: t('home.landing.accessSteps.client.title'), description: t('home.landing.accessSteps.client.description') },
])

const statusItems = computed(() => [
  { label: t('nav.buySubscription'), detail: t('home.landing.actions.rechargeEntry'), active: true },
  { label: t('nav.channelMonitor'), detail: t('home.landing.metrics.gateway'), active: appStore.cachedPublicSettings?.channel_monitor_enabled !== false },
  { label: t('nav.availableChannels'), detail: t('home.landing.sections.compatibility'), active: appStore.cachedPublicSettings?.available_channels_enabled === true },
])

const homepageGroups = computed(() => homepageStatus.value?.groups ?? [])
const homepageMonitors = computed(() => homepageStatus.value?.monitors ?? [])
const showHomepageStatus = computed(() =>
  homepageStatus.value?.enabled === true
  && (homepageGroups.value.length > 0 || homepageMonitors.value.length > 0)
)

function formatGroupRate(value: number): string {
  return Number.isFinite(value) ? `${formatMultiplier(value)}x` : '--'
}

function formatMonitorUptime(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  const normalized = Math.min(100, Math.max(0, value))
  return `${Number(normalized.toFixed(2))}%`
}

function normalizeMonitorStatus(status: string): 'operational' | 'degraded' | 'failed' | 'error' | 'unknown' {
  const normalized = status.trim().toLowerCase()
  if (
    normalized === 'operational'
    || normalized === 'degraded'
    || normalized === 'failed'
    || normalized === 'error'
  ) {
    return normalized
  }
  return 'unknown'
}

function monitorStatusLabel(status: string): string {
  return t(`monitorCommon.status.${normalizeMonitorStatus(status)}`)
}

async function loadHomepageStatus(): Promise<void> {
  homepageStatusController?.abort()
  const controller = new AbortController()
  homepageStatusController = controller

  try {
    const response = await getHomepageStatus({ signal: controller.signal })
    if (controller.signal.aborted || homepageStatusController !== controller) return
    homepageStatus.value = response
  } catch {
    // This public summary is optional; keep the homepage usable if it is unavailable.
  } finally {
    if (homepageStatusController === controller) homepageStatusController = null
  }
}

let mounted = true
onMounted(async () => {
  authStore.checkAuth()
  if (!appStore.publicSettingsLoaded) {
    try {
      await appStore.fetchPublicSettings()
    } catch {
      return
    }
  }
  if (mounted && !trimmedHomeContent.value && !compactHomeEnabled.value) await loadHomepageStatus()
})

onBeforeUnmount(() => {
  homepageStatusController?.abort()
  homepageStatusController = null
  mounted = false
})
</script>

<style scoped>
.z30-home {
  --geist-background-100: #080d11;
  --geist-background-200: #0d1419;
  --geist-background-300: #121d23;
  --geist-foreground-100: #ededed;
  --geist-foreground-200: #a1a1a1;
  --geist-foreground-300: #a2b0b6;
  --geist-foreground-400: #a3aeb4;
  --geist-border-100: #29333a;
  --geist-border-200: #333333;
  --geist-border-300: #525252;
  --geist-green: #a1e6c3;
  position: relative;
  isolation: isolate;
  background: #080d11;
  color: #ededed;
  color-scheme: dark;
  font-family: 'Geist Variable', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow-x: clip;
}

.home-shell {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
}

.home-provider-name, .home-final-cta > div { display: inline-flex; align-items: center; }

.home-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 560;
  white-space: nowrap;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.home-button { padding: 0 14px; }
.home-button-light { background: #ffffff; color: #0a0a0a; }
.home-button-light:hover { background: #e6e6e6; }
.home-kicker { margin: 0; color: var(--geist-green); font: 11px/1.4 'Geist Mono Variable', monospace; letter-spacing: .13em; text-transform: uppercase; }
.home-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--geist-green); }

.home-signal-strip {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid var(--geist-border-100);
  background: rgba(5, 5, 5, 0.78);
  backdrop-filter: blur(12px);
}

.home-signal-grid {
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 1fr);
}

.home-signal-cell {
  display: grid;
  min-width: 0;
  gap: 7px;
  padding: 20px;
  border-right: 1px solid var(--geist-border-100);
}
.home-signal-cell:first-child { border-left: 1px solid var(--geist-border-100); }
.home-signal-cell span { color: var(--geist-foreground-300); font-size: 11px; }
.home-signal-cell strong { overflow: hidden; font-size: 13px; font-weight: 560; text-overflow: ellipsis; white-space: nowrap; }
.home-signal-endpoint strong { font-family: 'Geist Mono Variable', monospace; }

.home-main { position: relative; z-index: 1; background: transparent; }
.home-section { padding-top: 104px; padding-bottom: 104px; scroll-margin-top: 64px; }
.home-section-heading { display: grid; max-width: 680px; gap: 14px; }
.home-section-heading-row { grid-template-columns: minmax(0, 1fr) minmax(280px, 0.7fr); max-width: none; align-items: end; gap: 72px; }
.home-section-heading h2 { margin: 0; font-size: 40px; font-weight: 600; line-height: 1.1; }
.home-section-heading p:not(.home-kicker) { margin: 0; color: var(--geist-foreground-300); font-size: 14px; line-height: 1.65; }

.home-action-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 34px;
  perspective: 1200px;
}

.home-action {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 18px;
  gap: 12px;
  min-height: 108px;
  align-items: start;
  padding: 16px;
  border: 1px solid var(--geist-border-100);
  border-radius: 8px;
  background: rgba(8, 8, 8, 0.88);
  color: inherit;
  transition: border-color 150ms ease, background-color 150ms ease, transform 150ms ease;
}
.home-action:hover { border-color: var(--geist-border-300); background: var(--geist-background-200); transform: translateY(-2px); }
.home-action-icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border: 1px solid var(--geist-border-100); border-radius: 6px; background: var(--geist-background-200); }
.home-action-copy { display: grid; min-width: 0; gap: 5px; }
.home-action-copy strong { font-size: 14px; font-weight: 600; }
.home-action-copy small { color: var(--geist-foreground-300); font-size: 12px; line-height: 1.45; }
.home-action-arrow { color: var(--geist-foreground-400); }

.home-section-tint { border-top: 1px solid var(--geist-border-100); border-bottom: 1px solid var(--geist-border-100); background: var(--geist-background-200); }
.home-feature-layout { display: grid; grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.4fr); gap: 80px; }
.home-feature-intro { align-self: start; position: sticky; top: 96px; }
.home-product-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--geist-border-100); }
.home-product-grid { perspective: 1200px; }
.home-feature { min-height: 320px; padding: 22px; border-right: 1px solid var(--geist-border-100); border-bottom: 1px solid var(--geist-border-100); }
.home-feature:first-child { border-left: 1px solid var(--geist-border-100); }
.home-feature-meta { display: flex; align-items: center; justify-content: space-between; color: var(--geist-foreground-400); font-family: 'Geist Mono Variable', monospace; font-size: 11px; }
.home-feature h3 { margin: 108px 0 10px; font-size: 18px; font-weight: 600; }
.home-feature p { margin: 0; color: var(--geist-foreground-300); font-size: 13px; line-height: 1.65; }

.home-compatibility { display: grid; grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.4fr); gap: 80px; }
.home-provider-list { border-top: 1px solid var(--geist-border-100); }
.home-provider-row { display: grid; grid-template-columns: 1fr 1fr auto; min-height: 64px; align-items: center; gap: 16px; border-bottom: 1px solid var(--geist-border-100); }
.home-provider-name { gap: 10px; }
.home-provider-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--geist-green); }
.home-provider-row strong { font-size: 14px; font-weight: 600; }
.home-provider-row > span { color: var(--geist-foreground-300); font-size: 12px; }
.home-provider-row small { padding: 3px 7px; border: 1px solid var(--geist-border-100); border-radius: 999px; color: var(--geist-green); font-size: 10px; text-transform: uppercase; }
.home-provider-row small.is-muted { color: var(--geist-foreground-400); }

.home-homepage-status {
  display: grid;
  grid-template-columns: minmax(220px, 0.5fr) minmax(0, 1.5fr);
  gap: 80px;
  border-top: 1px solid var(--geist-border-100);
}
.home-homepage-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px; }
.home-homepage-status-grid.is-single { grid-template-columns: 1fr; }
.home-homepage-status-panel { min-width: 0; }
.home-homepage-status-label { display: flex; align-items: center; justify-content: space-between; min-height: 28px; color: var(--geist-foreground-400); font-family: 'Geist Mono Variable', monospace; font-size: 10px; text-transform: uppercase; }
.home-homepage-status-label small { color: var(--geist-foreground-400); font-size: 9px; }
.home-homepage-status-list { border-top: 1px solid var(--geist-border-100); }
.home-homepage-status-row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; min-height: 68px; align-items: center; gap: 12px; border-bottom: 1px solid var(--geist-border-100); }
.home-homepage-status-row > div:not(.home-homepage-status-value) { display: grid; min-width: 0; gap: 3px; }
.home-homepage-status-row strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 600; }
.home-homepage-status-row div > span { overflow: hidden; color: var(--geist-foreground-300); font-size: 10px; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.home-homepage-status-indicator { width: 7px; height: 7px; border-radius: 999px; background: var(--geist-foreground-400); }
.home-homepage-status-indicator.is-operational { background: var(--geist-green); }
.home-homepage-status-indicator.is-degraded { background: #d9a441; }
.home-homepage-status-indicator.is-failed,
.home-homepage-status-indicator.is-error { background: #e15b64; }
.home-homepage-status-value { display: grid; min-width: 78px; justify-items: end; gap: 4px; font-family: 'Geist Mono Variable', monospace; text-align: right; }
.home-homepage-status-value small { color: var(--geist-foreground-400); font-size: 8px; text-transform: uppercase; }
.home-homepage-status-value strong { font-size: 12px; font-weight: 560; }

.home-section-dark { background: #080d11; color: #ffffff; }
.home-section-dark .home-section-heading p:not(.home-kicker) { color: #a2b0b6; }
.home-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 52px; border-top: 1px solid #29333a; border-bottom: 1px solid #29333a; }
.home-steps { perspective: 1200px; }
.home-step { min-height: 230px; padding: 22px; border-right: 1px solid #29333a; }
.home-step:first-child { border-left: 1px solid #29333a; }
.home-step > span { color: #a3aeb4; font-family: 'Geist Mono Variable', monospace; font-size: 11px; }
.home-step strong { display: block; margin-top: 68px; font-size: 16px; font-weight: 600; }
.home-step p { margin: 10px 0 0; color: #a2b0b6; font-size: 13px; line-height: 1.6; }
.home-final-cta { display: flex; min-height: 78px; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid #29333a; }
.home-final-cta > div { gap: 10px; }
.home-final-cta strong { font-size: 13px; font-weight: 560; }
.home-final-cta small { color: #a3aeb4; font-family: 'Geist Mono Variable', monospace; font-size: 11px; }

.home-status-section { display: grid; grid-template-columns: minmax(220px, 0.5fr) minmax(0, 1.5fr); gap: 80px; padding-bottom: 104px; }
.home-status-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--geist-border-100); }
.home-status-row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 76px; padding: 12px 16px; border-right: 1px solid var(--geist-border-100); border-bottom: 1px solid var(--geist-border-100); background: rgba(5, 5, 5, 0.76); }
.home-status-row:nth-child(odd) { border-left: 1px solid var(--geist-border-100); }
.home-status-indicator { width: 7px; height: 7px; border-radius: 999px; background: var(--geist-foreground-400); }
.home-status-indicator.is-active { background: var(--geist-green); }
.home-status-row > div { display: grid; gap: 3px; }
.home-status-row strong { font-size: 13px; font-weight: 600; }
.home-status-row div span { color: var(--geist-foreground-300); font-size: 11px; }
.home-status-row small { color: var(--geist-foreground-400); font-size: 10px; text-transform: uppercase; }

.home-terminal-cta {
  position: relative;
  z-index: 2;
  border-top: 1px solid var(--geist-border-100);
  background: rgba(5, 5, 5, 0.3);
}

.home-terminal-cta-inner {
  display: grid;
  min-height: 300px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 64px;
}

.home-terminal-cta-inner > div { display: grid; gap: 18px; }

.home-terminal-cta h2 {
  max-width: 760px;
  margin: 0;
  font-size: 52px;
  font-weight: 560;
  line-height: 1.08;
}

.home-terminal-cta-inner > div > p:last-child {
  margin: 0;
  color: #777777;
  font-family: 'Geist Mono Variable', monospace;
  font-size: 10px;
}

.home-terminal-cta-action { min-width: 132px; }

.home-footer { position: relative; z-index: 2; overflow: clip; border-top: 1px solid var(--geist-border-100); background: rgba(5, 5, 5, 0.76); }
.home-footer-inner { display: flex; min-height: 88px; align-items: center; justify-content: space-between; gap: 20px; color: var(--geist-foreground-300); font-size: 12px; }
.home-footer p { margin: 0; }
.home-footer div div { display: flex; flex-wrap: wrap; gap: 16px; }
.home-footer a:hover { color: var(--geist-foreground-100); }

@media (max-width: 1040px) {
  .home-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-feature-layout,
  .home-compatibility,
  .home-homepage-status,
  .home-status-section { grid-template-columns: 1fr; gap: 42px; }
  .home-feature-intro { position: static; }
}

@media (max-width: 720px) {
  .home-shell { width: min(100% - 28px, 1180px); }
  .home-terminal-cta-inner { min-height: 330px; grid-template-columns: 1fr; align-content: center; gap: 36px; }
  .home-terminal-cta h2 { font-size: 36px; }
  .home-terminal-cta-action { width: 100%; }
  .home-signal-grid { grid-template-columns: 1fr 1fr; }
  .home-signal-cell,
  .home-signal-cell:first-child { padding: 14px; border-left: 0; border-bottom: 1px solid var(--geist-border-100); }
  .home-signal-cell:nth-child(2n) { border-right: 0; }
  .home-section { padding-top: 72px; padding-bottom: 72px; }
  .home-status-section { padding-bottom: 72px; }
  .home-section-heading-row { grid-template-columns: 1fr; align-items: start; gap: 20px; }
  .home-section-heading h2 { font-size: 32px; }
  .home-action-grid,
  .home-product-grid,
  .home-steps,
  .home-homepage-status-grid,
  .home-status-list { grid-template-columns: 1fr; }
  .home-action { min-height: 96px; }
  .home-feature { min-height: 240px; border-left: 1px solid var(--geist-border-100); }
  .home-feature h3 { margin-top: 64px; }
  .home-provider-row { grid-template-columns: 1fr auto; padding: 12px 0; }
  .home-provider-row > span { grid-column: 1 / -1; grid-row: 2; }
  .home-step { min-height: 188px; border-left: 1px solid #29333a; border-bottom: 1px solid #29333a; }
  .home-step strong { margin-top: 48px; }
  .home-final-cta { align-items: flex-start; flex-direction: column; padding: 22px 0; }
  .home-final-cta > div { flex-wrap: wrap; }
  .home-status-row { border-left: 1px solid var(--geist-border-100); }
  .home-footer-inner { align-items: flex-start; flex-direction: column; justify-content: center; padding: 24px 0; }
}

@media (prefers-reduced-motion: reduce) {
  .home-action { transition-duration: 1ms; }
  .home-action:hover { transform: none; }
}
</style>
