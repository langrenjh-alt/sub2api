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

  <SignalHero
    v-else
    :brand-name="brandName" :site-logo="siteLogo" :tagline="siteTagline"
    :workspace-path="workspacePath" :authenticated="isAuthenticated"
    :model-plaza="showModelPlazaEntry" :base-url="baseUrl" :doc-url="docUrl"
    :status="homepageStatus" :status-state="statusState" :recharge-url="rechargeUrl"
    :custom-endpoints="customEndpoints" :sample-ms="sampleMs" @refresh="loadHomepageStatus"
  />
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
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const homepageStatus = ref<HomepageStatusResponse | null>(null)

const statusState = ref<'loading' | 'ready' | 'error'>('loading')
const sampleMs = ref<number | null>(null)
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

async function loadHomepageStatus(): Promise<void> {
  homepageStatusController?.abort()
  const controller = new AbortController()
  homepageStatusController = controller
  statusState.value = 'loading'
  sampleMs.value = null
  const started = performance.now()

  try {
    const response = await getHomepageStatus({ signal: controller.signal })
    if (controller.signal.aborted || homepageStatusController !== controller) return
    homepageStatus.value = response
    sampleMs.value = Math.max(1, Math.round(performance.now() - started))
    statusState.value = 'ready'
  } catch {
    if (!controller.signal.aborted && homepageStatusController === controller) statusState.value = 'error'
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
      statusState.value = 'error'
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
