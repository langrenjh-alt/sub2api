<template>
  <iframe
    v-if="isHomeContentUrl"
    :src="trimmedHomeContent"
    class="h-screen w-full border-0"
    allowfullscreen
  ></iframe>

  <div v-else-if="trimmedHomeContent" v-html="homeContent"></div>

  <div v-else ref="homeRootRef" class="geist-home min-h-screen">
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
          <RouterLink :to="workspacePath" class="home-button home-button-light home-auth-link">
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
            <Icon name="arrowRight" size="sm" />
          </RouterLink>
        </div>
      </div>
    </header>

    <div class="home-scroll-progress" aria-hidden="true">
      <span>01</span>
      <i><b class="home-scroll-progress-fill"></b></i>
      <span>07</span>
    </div>

    <GatewayField ref="gatewayFieldRef" :active="fieldActive" class="home-field" />

    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-shell home-lunar-meta" aria-hidden="true">
        <span>LUNAR SURFACE / NASA LRO</span>
        <span>AI INFRASTRUCTURE / 2026</span>
      </div>

      <div class="home-shell home-hero-content">
        <p class="home-hero-overline">
          <span>UNIFIED AI GATEWAY</span>
          <i aria-hidden="true"></i>
          <span>统一智能网关</span>
        </p>
        <h1 id="home-title" class="home-hero-title">{{ brandName }}</h1>
        <div class="home-hero-copy">
          <p class="home-hero-statement">{{ siteTagline }}</p>
          <p v-if="heroDescription !== siteTagline" class="home-lead">{{ heroDescription }}</p>
        </div>

        <div class="home-hero-actions">
          <RouterLink :to="workspacePath" class="home-button home-button-light">
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
            <Icon name="arrowRight" size="sm" />
          </RouterLink>
          <a
            :href="rechargeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="home-button home-button-dark"
          >
            <Icon name="creditCard" size="sm" />
            {{ t('home.landing.actions.rechargeNow') }}
          </a>
        </div>
      </div>

      <div class="home-shell home-request-rail">
        <div class="home-request-method">
          <span>POST</span>
          <code>/v1/chat/completions</code>
        </div>
        <div class="home-request-state">
          <span class="home-live-dot" aria-hidden="true"></span>
          {{ t('home.landing.providerStatus.ready') }}
          <strong>200</strong>
        </div>
      </div>
    </section>

    <section class="home-signal-strip" aria-label="Gateway summary">
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

      <section class="home-mission-archive" aria-labelledby="mission-archive-title">
        <div class="home-shell home-mission-intro">
          <p class="home-kicker home-kicker-inverse">APOLLO ARCHIVE / 1972</p>
          <h2 id="mission-archive-title">
            <span>One gateway.</span>
            <span>Every frontier.</span>
          </h2>
          <p>从一个入口，抵达更远的边界。</p>
        </div>

        <figure class="home-mission-primary">
          <img
            src="/assets/home/apollo-17-astronaut.jpg"
            alt="Apollo 17 astronaut on the lunar surface with crew reflected in the visor"
            loading="lazy"
            decoding="async"
          />
          <figcaption class="home-shell">
            <span>FRAME 01 / LUNAR EVA</span>
            <span>APOLLO ARCHIVE / NASA</span>
          </figcaption>
        </figure>

        <div class="home-shell home-mission-secondary">
          <figure>
            <img
              src="/assets/home/apollo-17-lunar-rover.jpg"
              alt="Apollo 17 astronaut working beside the lunar rover and a large moon rock"
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <span>FRAME 02 / SURFACE OPERATIONS</span>
              <span>MISSION AS17</span>
            </figcaption>
          </figure>

          <div class="home-mission-copy">
            <span>02 / NEXT FRONTIER</span>
            <h3>通向下一片疆域的基础设施</h3>
            <p>Infrastructure for the next frontier.</p>
          </div>
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
            <p class="home-kicker home-kicker-inverse">READY / GATEWAY ONLINE</p>
            <h2 id="terminal-cta-title">下一段旅程，从这里开始。</h2>
            <p>YOUR GATEWAY IS READY / {{ siteTagline }}</p>
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
import GatewayField from '@/components/home/GatewayField.vue'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { useHomeParallax } from '@/composables/useHomeParallax'
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

interface GatewayFieldHandle {
  setScrollProgress(progress: number): void
}

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const homeRootRef = ref<HTMLElement | null>(null)
const gatewayFieldRef = ref<GatewayFieldHandle | null>(null)

useHomeParallax(homeRootRef, gatewayFieldRef)

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
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const apiBaseUrl = computed(() => appStore.cachedPublicSettings?.api_base_url || appStore.apiBaseUrl || '')
const customEndpoints = computed(() => appStore.cachedPublicSettings?.custom_endpoints ?? [])

const rechargeUrl = 'https://z30.top/purchase'
const baseUrl = computed(() => {
  const configured = apiBaseUrl.value.trim()
  if (configured) return configured
  return `${window.location.origin}/v1`
})

const fieldActive = ref(true)
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const workspacePath = computed(() =>
  isAuthenticated.value ? (isAdmin.value ? '/admin/dashboard' : '/dashboard') : '/login'
)
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
  { label: t('nav.tickets'), detail: t('common.contactSupport'), active: appStore.cachedPublicSettings?.ticket_system_enabled === true },
])

function updateFieldActivity() {
  fieldActive.value = document.visibilityState === 'visible'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

onMounted(() => {
  updateFieldActivity()
  document.addEventListener('visibilitychange', updateFieldActivity)
  authStore.checkAuth()
  if (!appStore.publicSettingsLoaded) appStore.fetchPublicSettings()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', updateFieldActivity)
})
</script>

<style scoped>
.geist-home {
  --geist-background-100: #050505;
  --geist-background-200: #0b0b0b;
  --geist-background-300: #151515;
  --geist-foreground-100: #ededed;
  --geist-foreground-200: #a1a1a1;
  --geist-foreground-300: #888888;
  --geist-foreground-400: #666666;
  --geist-border-100: #262626;
  --geist-border-200: #333333;
  --geist-border-300: #525252;
  --geist-green: #45d483;
  position: relative;
  isolation: isolate;
  background: #050505;
  color: #ededed;
  color-scheme: dark;
  font-family: 'Geist Variable', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow-x: clip;
}

.home-scroll-progress {
  position: fixed;
  z-index: 45;
  top: 50%;
  right: 18px;
  display: grid;
  justify-items: center;
  gap: 9px;
  color: var(--geist-foreground-400);
  font-family: 'Geist Mono Variable', monospace;
  font-size: 8px;
  pointer-events: none;
  transform: translateY(-50%);
}

.home-scroll-progress i {
  position: relative;
  display: block;
  width: 1px;
  height: 92px;
  overflow: hidden;
  background: var(--geist-border-200);
}

.home-scroll-progress b {
  position: absolute;
  inset: 0;
  display: block;
  background: var(--geist-foreground-100);
}

.home-shell {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
}

.home-topbar {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(3, 3, 3, 0.5);
  color: #ededed;
  backdrop-filter: blur(14px) saturate(120%);
}

.home-topbar-inner {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.home-brand,
.home-topbar-actions,
.home-hero-actions,
.home-request-method,
.home-request-state,
.home-provider-name,
.home-final-cta > div {
  display: inline-flex;
  align-items: center;
}

.home-brand {
  min-width: 0;
  gap: 10px;
  color: inherit;
}

.home-brand-mark {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid #333333;
  border-radius: 6px;
  background: #111111;
}

.home-brand-copy {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.home-brand-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}

.home-brand-copy span {
  overflow: hidden;
  max-width: 260px;
  color: #888888;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-topnav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.home-topnav a {
  padding: 7px 10px;
  border-radius: 6px;
  color: #a1a1a1;
  font-size: 13px;
  transition: background-color 150ms ease, color 150ms ease;
}

.home-topnav a:hover { background: #1a1a1a; color: #ffffff; }
.home-topbar-actions { gap: 8px; }

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
.home-button-dark { border-color: #333333; background: #111111; color: #ededed; }
.home-button-dark:hover { border-color: #666666; background: #1a1a1a; }

.home-hero {
  position: relative;
  z-index: 1;
  height: 100svh;
  min-height: 700px;
  background: transparent;
  color: #ffffff;
}

.home-hero::after {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: rgba(255, 255, 255, 0.055);
  content: '';
  pointer-events: none;
}

.home-field {
  position: fixed;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100svh;
  opacity: 1;
  pointer-events: none;
}

.home-lunar-meta {
  position: absolute;
  z-index: 2;
  top: 96px;
  right: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.38);
  font-family: 'Geist Mono Variable', monospace;
  font-size: 9px;
  pointer-events: none;
}

.home-hero-content {
  position: relative;
  z-index: 2;
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding-top: 76px;
  padding-bottom: 106px;
  pointer-events: none;
  text-align: left;
}

.home-hero-actions {
  pointer-events: auto;
}

.home-kicker {
  margin: 0;
  color: var(--geist-foreground-300);
  font-family: 'Geist Mono Variable', monospace;
  font-size: 11px;
  font-weight: 560;
  line-height: 1.3;
  text-transform: uppercase;
}

.home-kicker-inverse { color: #a1a1a1; }
.home-live-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #45d483;
  box-shadow: 0 0 0 4px rgba(69, 212, 131, 0.12);
}
.home-kicker .home-live-dot { display: inline-block; margin-right: 8px; }

.home-hero-overline {
  display: flex;
  width: min(520px, 48%);
  align-items: center;
  gap: 14px;
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  font-family: 'Geist Mono Variable', monospace;
  font-size: 10px;
  line-height: 1.4;
}

.home-hero-overline i {
  width: 38px;
  height: 1px;
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.32);
}

.home-hero-title {
  width: min(710px, 60%);
  margin: 28px 0 0;
  overflow-wrap: anywhere;
  font-size: 112px;
  font-weight: 580;
  line-height: 0.86;
  text-shadow: 0 2px 18px #030303;
}

.home-hero-copy {
  display: grid;
  width: min(560px, 48%);
  gap: 8px;
  margin-top: 30px;
}

.home-hero-statement {
  margin: 0;
  color: #f0f0f0;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.45;
}

.home-lead {
  margin: 0;
  color: #8f8f8f;
  font-size: 14px;
  line-height: 1.65;
}

.home-hero-actions { gap: 10px; margin-top: 32px; }

.home-request-rail {
  position: absolute;
  z-index: 3;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  color: #888888;
  font-family: 'Geist Mono Variable', monospace;
  font-size: 11px;
  pointer-events: none;
}

.home-request-method { gap: 12px; }
.home-request-method span { color: #45d483; }
.home-request-method code { color: #a1a1a1; }
.home-request-state { gap: 9px; }
.home-request-state strong { color: #45d483; font-weight: 500; }

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

.home-mission-archive {
  position: relative;
  z-index: 2;
  overflow: clip;
  padding-top: 132px;
  border-top: 1px solid var(--geist-border-100);
  background: #050505;
  color: #ededed;
}

.home-mission-intro {
  display: grid;
  grid-template-columns: minmax(150px, 0.42fr) minmax(420px, 1.25fr) minmax(180px, 0.52fr);
  align-items: end;
  gap: 48px;
  padding-bottom: 72px;
}

.home-mission-intro .home-kicker { align-self: start; }

.home-mission-intro h2 {
  margin: 0;
  font-size: 68px;
  font-weight: 560;
  line-height: 0.96;
}

.home-mission-intro h2 span { display: block; }
.home-mission-intro h2 span:last-child { color: #686868; }
.home-mission-intro > p:last-child { margin: 0 0 5px; color: #a1a1a1; font-size: 16px; line-height: 1.6; }

.home-mission-primary,
.home-mission-secondary figure { margin: 0; }

.home-mission-primary {
  position: relative;
  height: min(86svh, 900px);
  min-height: 620px;
  border-top: 1px solid #262626;
  border-bottom: 1px solid #262626;
  background: #090909;
}

.home-mission-primary img,
.home-mission-secondary img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.home-mission-primary img { object-position: center 48%; }

.home-mission-primary figcaption,
.home-mission-secondary figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #777777;
  font-family: 'Geist Mono Variable', monospace;
  font-size: 9px;
}

.home-mission-primary figcaption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  min-height: 52px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(5, 5, 5, 0.72);
  color: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
}

.home-mission-secondary {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  align-items: stretch;
  gap: 80px;
  padding-top: 120px;
  padding-bottom: 140px;
}

.home-mission-secondary figure { display: grid; gap: 14px; }
.home-mission-secondary img { height: auto; aspect-ratio: 1; }
.home-mission-secondary figcaption { padding-top: 2px; }

.home-mission-copy {
  display: grid;
  min-height: 100%;
  grid-template-rows: auto 1fr auto;
  padding-top: 16px;
  border-top: 1px solid #333333;
}

.home-mission-copy > span,
.home-mission-copy > p {
  color: #777777;
  font-family: 'Geist Mono Variable', monospace;
  font-size: 10px;
}

.home-mission-copy h3 {
  align-self: end;
  margin: 0 0 24px;
  font-size: 42px;
  font-weight: 560;
  line-height: 1.12;
}

.home-mission-copy > p { margin: 0; font-size: 12px; }

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

.home-section-dark { background: #050505; color: #ffffff; }
.home-section-dark .home-section-heading p:not(.home-kicker) { color: #888888; }
.home-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 52px; border-top: 1px solid #262626; border-bottom: 1px solid #262626; }
.home-steps { perspective: 1200px; }
.home-step { min-height: 230px; padding: 22px; border-right: 1px solid #262626; }
.home-step:first-child { border-left: 1px solid #262626; }
.home-step > span { color: #666666; font-family: 'Geist Mono Variable', monospace; font-size: 11px; }
.home-step strong { display: block; margin-top: 68px; font-size: 16px; font-weight: 600; }
.home-step p { margin: 10px 0 0; color: #888888; font-size: 13px; line-height: 1.6; }
.home-final-cta { display: flex; min-height: 78px; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid #262626; }
.home-final-cta > div { gap: 10px; }
.home-final-cta strong { font-size: 13px; font-weight: 560; }
.home-final-cta small { color: #666666; font-family: 'Geist Mono Variable', monospace; font-size: 11px; }

.home-status-section { display: grid; grid-template-columns: minmax(220px, 0.5fr) minmax(0, 1.5fr); gap: 80px; padding-bottom: 240px; }
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

.home-field,
.home-hero-content,
.home-lunar-meta,
.home-mission-intro,
.home-mission-primary img,
.home-mission-secondary,
.home-signal-cell,
.home-action,
.home-feature,
.home-provider-row,
.home-step,
.home-status-list {
  will-change: transform, opacity;
}

@media (max-width: 1040px) {
  .home-scroll-progress { display: none; }
  .home-topnav { display: none; }
  .home-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-feature-layout,
  .home-compatibility,
  .home-status-section { grid-template-columns: 1fr; gap: 42px; }
  .home-feature-intro { position: static; }
  .home-hero-title { width: 62%; font-size: 86px; }
  .home-hero-copy { width: 50%; }
  .home-mission-intro { grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.8fr); gap: 32px; }
  .home-mission-intro .home-kicker { grid-column: 1 / -1; }
  .home-mission-intro h2 { font-size: 56px; }
  .home-mission-secondary { grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr); gap: 42px; }
  .home-mission-copy h3 { font-size: 34px; }
}

@media (max-width: 720px) {
  .home-shell { width: min(100% - 28px, 1180px); }
  .home-topbar-inner { min-height: 58px; }
  .home-brand-copy span,
  .home-auth-link { display: none; }
  .home-hero { height: 100svh; min-height: 680px; }
  .home-hero::after { display: none; }
  .home-lunar-meta { top: 78px; }
  .home-lunar-meta span:last-child { display: none; }
  .home-hero-content { justify-content: flex-start; padding-top: 124px; padding-bottom: 64px; }
  .home-hero-overline { width: 100%; gap: 10px; font-size: 9px; }
  .home-hero-overline i { width: 24px; }
  .home-hero-title { width: 100%; margin-top: 20px; font-size: 56px; line-height: 0.92; }
  .home-hero-copy { width: 94%; gap: 6px; margin-top: 18px; }
  .home-hero-statement { font-size: 16px; line-height: 1.4; }
  .home-lead { font-size: 12px; line-height: 1.5; }
  .home-hero-actions { flex-wrap: wrap; justify-content: flex-start; margin-top: 20px; }
  .home-request-rail { min-height: 54px; }
  .home-request-method code { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .home-mission-archive { padding-top: 80px; }
  .home-mission-intro { grid-template-columns: 1fr; gap: 20px; padding-bottom: 48px; }
  .home-mission-intro .home-kicker { grid-column: auto; }
  .home-mission-intro h2 { font-size: 44px; line-height: 1; }
  .home-mission-intro > p:last-child { font-size: 14px; }
  .home-mission-primary { height: 72svh; min-height: 520px; }
  .home-mission-primary img { object-position: 51% center; }
  .home-mission-primary figcaption { min-height: 46px; }
  .home-mission-primary figcaption span:last-child { display: none; }
  .home-mission-secondary { grid-template-columns: 1fr; gap: 52px; padding-top: 72px; padding-bottom: 88px; }
  .home-mission-copy { min-height: 280px; }
  .home-mission-copy h3 { font-size: 32px; }
  .home-terminal-cta-inner { min-height: 330px; grid-template-columns: 1fr; align-content: center; gap: 36px; }
  .home-terminal-cta h2 { font-size: 36px; }
  .home-terminal-cta-action { width: 100%; }
  .home-signal-grid { grid-template-columns: 1fr 1fr; }
  .home-signal-cell,
  .home-signal-cell:first-child { padding: 14px; border-left: 0; border-bottom: 1px solid var(--geist-border-100); }
  .home-signal-cell:nth-child(2n) { border-right: 0; }
  .home-section { padding-top: 72px; padding-bottom: 72px; }
  .home-status-section { padding-bottom: 180px; }
  .home-section-heading-row { grid-template-columns: 1fr; align-items: start; gap: 20px; }
  .home-section-heading h2 { font-size: 32px; }
  .home-action-grid,
  .home-product-grid,
  .home-steps,
  .home-status-list { grid-template-columns: 1fr; }
  .home-action { min-height: 96px; }
  .home-feature { min-height: 240px; border-left: 1px solid var(--geist-border-100); }
  .home-feature h3 { margin-top: 64px; }
  .home-provider-row { grid-template-columns: 1fr auto; padding: 12px 0; }
  .home-provider-row > span { grid-column: 1 / -1; grid-row: 2; }
  .home-step { min-height: 188px; border-left: 1px solid #262626; border-bottom: 1px solid #262626; }
  .home-step strong { margin-top: 48px; }
  .home-final-cta { align-items: flex-start; flex-direction: column; padding: 22px 0; }
  .home-final-cta > div { flex-wrap: wrap; }
  .home-status-row { border-left: 1px solid var(--geist-border-100); }
  .home-footer-inner { align-items: flex-start; flex-direction: column; justify-content: center; padding: 24px 0; }
}

@media (prefers-reduced-motion: reduce) {
  .home-field { position: absolute; height: 100svh; }
  .home-action { transition-duration: 1ms; }
  .home-action:hover { transform: none; }
}
</style>
