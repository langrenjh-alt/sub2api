<template>
  <div class="auth-shell min-h-screen">
    <div class="auth-grid pointer-events-none fixed inset-0"></div>
    <div class="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      <section class="hidden border-r border-[var(--geist-border-100)] px-8 py-8 lg:flex lg:flex-col lg:justify-between">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-black text-white dark:bg-white dark:text-black">
            <img :src="siteLogo || '/logo.png'" alt="" class="h-full w-full object-contain" />
          </span>
          <div>
            <p class="text-sm font-semibold">{{ siteName }}</p>
            <p class="text-xs text-[var(--geist-foreground-300)]">{{ siteSubtitle }}</p>
          </div>
        </div>

        <div class="max-w-xl">
          <p class="mb-4 font-mono text-xs uppercase text-[var(--geist-foreground-300)]">Secure access</p>
          <h1 class="text-5xl font-semibold leading-none md:text-6xl">登录后进入统一控制台。</h1>
          <p class="mt-6 max-w-lg text-base leading-7 text-[var(--geist-foreground-200)]">
            账号、密钥、订阅和充值都在同一个界面里完成。界面保持简洁，只让最常用的操作靠近你。
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div v-for="item in highlights" :key="item.title" class="rounded-md border border-[var(--geist-border-100)] bg-[var(--geist-background-100)] p-4">
            <p class="text-xs text-[var(--geist-foreground-300)]">{{ item.title }}</p>
            <p class="mt-2 text-sm font-medium">{{ item.value }}</p>
          </div>
        </div>
      </section>

      <section class="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div class="w-full max-w-[460px]">
          <div class="mb-8 flex items-center justify-between lg:hidden">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-black text-white dark:bg-white dark:text-black">
                <img :src="siteLogo || '/logo.png'" alt="" class="h-full w-full object-contain" />
              </span>
              <div>
                <p class="text-sm font-semibold">{{ siteName }}</p>
                <p class="text-xs text-[var(--geist-foreground-300)]">{{ siteSubtitle }}</p>
              </div>
            </div>
          </div>

          <div class="auth-panel p-6 sm:p-8">
            <slot />
          </div>

          <div class="mt-6 px-1 text-sm">
            <slot name="footer" />
          </div>

          <p class="mt-8 text-xs text-[var(--geist-foreground-400)]">&copy; {{ currentYear }} {{ siteName }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'

const appStore = useAppStore()

const siteName = computed(() => appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(
  () => appStore.cachedPublicSettings?.site_subtitle || 'Subscription to API Conversion Platform'
)
const currentYear = computed(() => new Date().getFullYear())

const highlights = [
  { title: 'Unified API', value: 'OpenAI compatible' },
  { title: 'Routing', value: 'Auto failover' },
  { title: 'Billing', value: 'Token-aware' }
]

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>

<style scoped>
.auth-grid {
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: linear-gradient(to bottom, black 0%, black 72%, transparent 100%);
}

.auth-shell {
  background: var(--geist-background-200);
  color: var(--geist-foreground-100);
}

.auth-panel {
  border: 1px solid var(--geist-border-100);
  border-radius: 8px;
  background: var(--geist-background-100);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.07);
}

.dark .auth-panel {
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.32);
}

.dark .auth-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
}
</style>
