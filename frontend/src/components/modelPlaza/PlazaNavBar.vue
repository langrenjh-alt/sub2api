<template>
  <header
    class="sticky top-0 z-30 border-b border-border bg-card text-card-foreground"
  >
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
      <!-- 左:站点 logo + 名称 -->
      <RouterLink to="/home" class="flex min-w-0 items-center gap-3" :aria-label="t('common.gatewayHome')">
        <template v-if="settings">
          <span
            class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
          >
            <img :src="siteLogo || '/logo.svg'" alt="" class="h-full w-full object-contain" />
          </span>
          <span class="truncate text-base font-semibold text-gray-950 dark:text-white">
            {{ siteName }}
          </span>
        </template>
        <template v-else>
          <span class="h-9 w-9 flex-shrink-0 animate-pulse rounded-xl bg-gray-200 dark:bg-dark-700" aria-hidden="true"></span>
          <span class="h-5 w-28 animate-pulse rounded bg-gray-200 dark:bg-dark-700" aria-hidden="true"></span>
        </template>
      </RouterLink>

      <Button as-child class="shrink-0">
        <RouterLink :to="isAuthenticated ? backTarget : { path: '/login', query: { redirect: '/model-plaza' } }">
          {{ isAuthenticated ? t('modelPlaza.nav.backToDashboard') : t('modelPlaza.nav.login') }}
        </RouterLink>
      </Button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { sanitizeUrl } from '@/utils/url'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

const settings = computed(() => appStore.cachedPublicSettings)
const siteName = computed(() => settings.value?.site_name || 'Sub2API')
const siteLogo = computed(() =>
  sanitizeUrl(settings.value?.site_logo || '', { allowRelative: true, allowDataUrl: true })
)
const isAuthenticated = computed(() => authStore.isAuthenticated)
const backTarget = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))
</script>
