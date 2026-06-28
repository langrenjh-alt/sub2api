<template>
  <div v-if="homeContent" class="home-content-shell min-h-screen">
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <div v-else v-html="homeContent"></div>
  </div>

  <div v-else class="geist-home min-h-screen">
    <header class="geist-topbar">
      <div class="geist-topbar-inner">
        <RouterLink to="/home" class="geist-brand" aria-label="Home">
          <span class="geist-brand-mark">
            <img :src="siteLogo || '/logo.png'" alt="" class="h-full w-full object-contain" />
          </span>
          <span class="geist-brand-text">
            <strong>{{ brandName }}</strong>
            <span>{{ t('home.landing.heroSubtitle') }}</span>
          </span>
        </RouterLink>

        <div class="geist-topbar-actions">
          <LocaleSwitcher />
          <button
            @click="toggleTheme"
            class="geist-icon-button"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            type="button"
          >
            <Icon v-if="isDark" name="sun" size="sm" />
            <Icon v-else name="moon" size="sm" />
          </button>
          <RouterLink
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="geist-button geist-button-primary"
          >
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
            <Icon name="arrowRight" size="sm" />
          </RouterLink>
        </div>
      </div>
    </header>

    <main class="geist-layout">
      <aside class="geist-rail">
        <nav class="geist-rail-nav" aria-label="Home sections">
          <a href="#overview">{{ t('home.landing.sections.overview') }}</a>
          <a href="#actions">{{ t('home.landing.sections.quickActions') }}</a>
          <a href="#compatibility">{{ t('home.landing.sections.compatibility') }}</a>
          <a href="#access">{{ t('home.landing.sections.accessSteps') }}</a>
        </nav>

        <div class="geist-rail-card">
          <p class="geist-kicker">Base URL</p>
          <strong>/v1</strong>
          <span>OpenAI compatible gateway</span>
        </div>

        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" class="geist-rail-link">
          <Icon name="document" size="sm" />
          <span>{{ t('home.docs') }}</span>
        </a>
      </aside>

      <section class="geist-content">
        <div class="geist-section-head" id="overview">
          <p class="geist-kicker">Home</p>
          <h1>{{ brandName }}</h1>
          <p class="geist-lead">
            {{ heroSubtitle }}
          </p>
        </div>

        <div class="geist-grid">
          <article class="geist-panel geist-panel-hero">
            <div class="geist-panel-head">
              <span>{{ t('home.landing.sections.overview') }}</span>
              <span>{{ currentYear }}</span>
            </div>

            <div class="geist-stack">
              <p class="geist-copy">
                {{ t('home.landing.ctaBanner') }}
              </p>

              <div class="geist-actions" id="actions">
                <a :href="rechargeUrl" target="_blank" rel="noopener noreferrer" class="geist-button geist-button-primary">
                  {{ t('home.landing.actions.rechargeNow') }}
                  <Icon name="externalLink" size="sm" />
                </a>
                <RouterLink
                  :to="isAuthenticated ? dashboardPath : '/login'"
                  class="geist-button geist-button-secondary"
                >
                  {{ isAuthenticated ? t('home.landing.actions.openWorkspace') : t('home.getStarted') }}
                  <Icon name="arrowRight" size="sm" />
                </RouterLink>
              </div>
            </div>
          </article>

          <article class="geist-panel geist-panel-compact">
            <div class="geist-panel-head">
              <span>{{ t('home.landing.sections.status') }}</span>
              <span>Live</span>
            </div>

            <div class="geist-metrics">
              <div v-for="metric in heroMetrics" :key="metric.label" class="geist-metric">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <small>{{ metric.detail }}</small>
              </div>
            </div>
          </article>
        </div>

        <section class="geist-section" id="compatibility">
          <div class="geist-section-head">
            <p class="geist-kicker">{{ t('home.landing.sections.compatibility') }}</p>
            <h2>{{ t('home.landing.modelsTitle') }}</h2>
          </div>

          <div class="geist-chips">
            <span v-for="logo in modelLogos" :key="logo.name">{{ logo.name }}</span>
          </div>

          <div class="geist-provider-grid">
            <article v-for="provider in providers" :key="provider.name" class="geist-provider">
              <div>
                <strong>{{ provider.name }}</strong>
                <p>{{ provider.caption }}</p>
              </div>
              <span>{{ provider.status }}</span>
            </article>
          </div>
        </section>

        <section class="geist-section" id="access">
          <div class="geist-section-head">
            <p class="geist-kicker">{{ t('home.landing.sections.accessSteps') }}</p>
            <h2>{{ t('home.landing.accessTitle') }}</h2>
          </div>

          <div class="geist-steps">
            <article v-for="step in accessSteps" :key="step.title" class="geist-step">
              <span>{{ step.index }}</span>
              <div>
                <strong>{{ step.title }}</strong>
                <p>{{ step.description }}</p>
              </div>
            </article>
          </div>

          <div class="geist-code">
            <div class="geist-panel-head">
              <span>request.ts</span>
              <span>{{ t('home.landing.sections.quickActions') }}</span>
            </div>
            <pre><code>const client = new OpenAI({
  baseURL: 'https://z30.top/v1',
  apiKey: 'sk-z30...'
})</code></pre>
          </div>
        </section>
      </section>
    </main>

    <footer class="geist-footer">
      <p>&copy; {{ currentYear }} {{ brandName }}</p>
      <div>
        <a :href="siteUrl" target="_blank" rel="noopener noreferrer">z30.top</a>
        <a :href="rechargeUrl" target="_blank" rel="noopener noreferrer">{{ t('home.landing.nav.recharge') }}</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()

const configuredSiteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || '')
const brandName = computed(() => {
  const value = configuredSiteName.value.trim()
  return value && value !== 'Sub2API' ? value : 'Z30 API'
})
const siteLogo = computed(() => appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '')
const heroSubtitle = computed(
  () =>
    appStore.cachedPublicSettings?.site_subtitle ||
    t('home.landing.heroSubtitle')
)
const docUrl = computed(() => appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')

const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

const isDark = ref(document.documentElement.classList.contains('dark'))
const siteUrl = 'https://z30.top'
const rechargeUrl = 'https://catfk.com/shop/Z30AI'

const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))
const currentYear = computed(() => new Date().getFullYear())

const modelLogos = [
  { name: 'Codex' },
  { name: 'Claude' },
  { name: 'Gemini' },
  { name: 'OpenAI' }
]

const heroMetrics = computed(() => [
  { label: 'Gateway', value: '99.9%', detail: t('home.landing.metrics.gateway') },
  { label: 'Billing', value: 'Usage', detail: t('home.landing.metrics.billing') },
  { label: 'Base URL', value: '/v1', detail: t('home.landing.metrics.baseUrl') }
])

const providers = computed(() => [
  { name: 'Codex', caption: t('home.landing.providerCaptions.codex'), status: t('home.landing.providerStatus.ready') },
  { name: 'Claude', caption: t('home.landing.providerCaptions.claude'), status: t('home.landing.providerStatus.ready') },
  { name: 'GPT', caption: t('home.landing.providerCaptions.gpt'), status: t('home.landing.providerStatus.ready') },
  { name: 'Gemini', caption: t('home.landing.providerCaptions.gemini'), status: t('home.landing.providerStatus.ready') },
  { name: 'Antigravity', caption: t('home.landing.providerCaptions.antigravity'), status: t('home.landing.providerStatus.ready') },
  { name: 'More', caption: t('home.landing.providerCaptions.more'), status: t('home.landing.providerStatus.soon') }
])

const accessSteps = computed(() => [
  {
    index: '01',
    title: t('home.landing.accessSteps.connect.title'),
    description: t('home.landing.accessSteps.connect.description')
  },
  {
    index: '02',
    title: t('home.landing.accessSteps.key.title'),
    description: t('home.landing.accessSteps.key.description')
  },
  {
    index: '03',
    title: t('home.landing.accessSteps.client.title'),
    description: t('home.landing.accessSteps.client.description')
  }
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

onMounted(async () => {
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
  background: #f7f7f4;
  font-family:
    "Inter",
    "SF Pro Display",
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

:global(.dark .geist-home) {
  color: #f5f5f3;
  background: #0e0e0d;
}

.geist-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(247, 247, 244, 0.86);
  backdrop-filter: blur(18px);
}

:global(.dark .geist-topbar) {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: rgba(14, 14, 13, 0.82);
}

.geist-topbar-inner,
.geist-layout,
.geist-footer {
  width: min(1280px, calc(100% - 32px));
  margin: 0 auto;
}

.geist-topbar-inner {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.geist-brand {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.geist-brand-mark {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid rgba(17, 17, 17, 0.08);
}

:global(.dark .geist-brand-mark) {
  background: #151515;
  border-color: rgba(255, 255, 255, 0.08);
}

.geist-brand-text {
  display: grid;
  min-width: 0;
}

.geist-brand-text strong,
.geist-section-head h1,
.geist-section-head h2,
.geist-panel-head,
.geist-provider strong,
.geist-step strong,
.geist-rail-card strong {
  letter-spacing: 0;
}

.geist-brand-text strong {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.1;
}

.geist-brand-text span {
  color: rgba(17, 17, 17, 0.55);
  font-size: 12px;
  line-height: 1.2;
}

:global(.dark .geist-brand-text span) {
  color: rgba(245, 245, 243, 0.56);
}

.geist-topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.geist-icon-button,
.geist-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

.geist-icon-button {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: #ffffff;
  color: #111111;
}

:global(.dark .geist-icon-button) {
  border-color: rgba(255, 255, 255, 0.08);
  background: #151515;
  color: #f5f5f3;
}

.geist-button {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
}

.geist-button-primary {
  background: #111111;
  color: #ffffff;
}

:global(.dark .geist-button-primary) {
  background: #f5f5f3;
  color: #111111;
}

.geist-button-secondary {
  border-color: rgba(17, 17, 17, 0.08);
  background: rgba(255, 255, 255, 0.8);
  color: #111111;
}

:global(.dark .geist-button-secondary) {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #f5f5f3;
}

.geist-layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 28px;
  padding: 32px 0 40px;
}

.geist-rail {
  position: sticky;
  top: 96px;
  align-self: start;
  display: grid;
  gap: 18px;
}

.geist-rail-nav {
  display: grid;
  gap: 4px;
}

.geist-rail-nav a,
.geist-rail-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  color: rgba(17, 17, 17, 0.72);
  font-size: 14px;
  font-weight: 500;
}

.geist-rail-nav a:hover,
.geist-rail-link:hover {
  background: rgba(17, 17, 17, 0.04);
}

:global(.dark .geist-rail-nav a),
:global(.dark .geist-rail-link) {
  color: rgba(245, 245, 243, 0.72);
}

:global(.dark .geist-rail-nav a:hover),
:global(.dark .geist-rail-link:hover) {
  background: rgba(255, 255, 255, 0.04);
}

.geist-rail-card,
.geist-panel,
.geist-code {
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(255, 255, 255, 0.72);
}

:global(.dark .geist-rail-card),
:global(.dark .geist-panel),
:global(.dark .geist-code) {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.geist-rail-card {
  display: grid;
  gap: 6px;
  padding: 16px;
  border-radius: 12px;
}

.geist-kicker {
  margin: 0;
  color: rgba(17, 17, 17, 0.48);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:global(.dark .geist-kicker) {
  color: rgba(245, 245, 243, 0.48);
}

.geist-rail-card strong {
  font-size: 20px;
  font-weight: 700;
}

.geist-rail-card span {
  color: rgba(17, 17, 17, 0.58);
  font-size: 13px;
}

:global(.dark .geist-rail-card span) {
  color: rgba(245, 245, 243, 0.58);
}

.geist-content {
  min-width: 0;
}

.geist-section-head {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}

.geist-section-head h1 {
  margin: 0;
  font-size: clamp(44px, 5.2vw, 82px);
  font-weight: 760;
  line-height: 0.96;
}

.geist-section-head h2 {
  margin: 0;
  font-size: clamp(26px, 2.8vw, 38px);
  font-weight: 720;
  line-height: 1.05;
}

.geist-lead {
  margin: 0;
  max-width: 760px;
  color: rgba(17, 17, 17, 0.62);
  font-size: clamp(16px, 1.6vw, 20px);
  line-height: 1.6;
}

:global(.dark .geist-lead),
:global(.dark .geist-copy),
:global(.dark .geist-metric span),
:global(.dark .geist-metric small),
:global(.dark .geist-provider p),
:global(.dark .geist-step p) {
  color: rgba(245, 245, 243, 0.62);
}

.geist-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  gap: 18px;
  margin-bottom: 22px;
}

.geist-panel {
  border-radius: 12px;
  padding: 18px;
}

.geist-panel-hero {
  min-height: 240px;
}

.geist-panel-compact {
  display: grid;
  gap: 16px;
}

.geist-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(17, 17, 17, 0.45);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:global(.dark .geist-panel-head) {
  color: rgba(245, 245, 243, 0.45);
}

.geist-stack {
  display: grid;
  gap: 18px;
  padding-top: 18px;
}

.geist-copy {
  margin: 0;
  max-width: 700px;
  font-size: 15px;
  line-height: 1.7;
}

.geist-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.geist-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.geist-metric {
  display: grid;
  gap: 6px;
  min-height: 122px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(255, 255, 255, 0.5);
}

:global(.dark .geist-metric) {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.geist-metric span,
.geist-metric small,
.geist-provider p,
.geist-step p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.geist-metric strong {
  font-size: 28px;
  line-height: 1;
}

.geist-section {
  display: grid;
  gap: 16px;
  padding-top: 18px;
}

.geist-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.geist-chips span {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(255, 255, 255, 0.66);
  font-size: 12px;
  font-weight: 600;
}

:global(.dark .geist-chips span) {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.geist-provider-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.geist-provider {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 72px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(255, 255, 255, 0.58);
}

:global(.dark .geist-provider) {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.geist-provider strong {
  display: block;
  font-size: 15px;
}

.geist-provider p {
  max-width: 420px;
}

.geist-provider span {
  flex: 0 0 auto;
  color: rgba(17, 17, 17, 0.45);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

:global(.dark .geist-provider span) {
  color: rgba(245, 245, 243, 0.45);
}

.geist-steps {
  display: grid;
  gap: 10px;
}

.geist-step {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(255, 255, 255, 0.58);
}

:global(.dark .geist-step) {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.geist-step > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 700;
}

:global(.dark .geist-step > span) {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.geist-step strong {
  display: block;
  margin-bottom: 4px;
  font-size: 15px;
}

.geist-step p {
  margin: 0;
  max-width: 720px;
}

.geist-code {
  border-radius: 12px;
  padding: 18px;
}

.geist-code pre {
  margin: 0;
  overflow: auto;
  padding-top: 16px;
  font-family:
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    Menlo,
    monospace;
  font-size: 13px;
  line-height: 1.7;
}

.geist-code code {
  color: #111111;
}

:global(.dark .geist-code code) {
  color: #f5f5f3;
}

.geist-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 0 36px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
  color: rgba(17, 17, 17, 0.56);
  font-size: 13px;
}

:global(.dark .geist-footer) {
  border-top-color: rgba(255, 255, 255, 0.08);
  color: rgba(245, 245, 243, 0.56);
}

.geist-footer p {
  margin: 0;
}

.geist-footer div {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 10px;
}

.geist-footer a {
  color: inherit;
}

@media (max-width: 1100px) {
  .geist-layout {
    grid-template-columns: 1fr;
  }

  .geist-rail {
    position: static;
    grid-template-columns: 1fr;
  }

  .geist-rail-nav {
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .geist-rail-card,
  .geist-rail-link {
    width: fit-content;
  }
}

@media (max-width: 760px) {
  .geist-topbar-inner,
  .geist-layout,
  .geist-footer {
    width: min(100% - 24px, 1280px);
  }

  .geist-topbar-inner {
    min-height: 64px;
    flex-wrap: wrap;
    justify-content: flex-start;
    padding: 8px 0;
  }

  .geist-topbar-actions {
    margin-left: auto;
    flex-wrap: wrap;
  }

  .geist-brand {
    max-width: 100%;
  }

  .geist-grid,
  .geist-provider-grid {
    grid-template-columns: 1fr;
  }

  .geist-metrics {
    grid-template-columns: 1fr;
  }

  .geist-footer,
  .geist-provider,
  .geist-step {
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
}
</style>
