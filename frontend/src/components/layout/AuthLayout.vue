<template>
  <div class="auth-shell min-h-screen">

    <div class="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      <section class="auth-mast relative isolate hidden overflow-hidden px-10 py-10 lg:flex lg:flex-col lg:justify-between xl:px-14">
        <div aria-hidden="true" class="auth-field"></div>
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md">
            <img :src="siteLogo || '/logo.svg'" alt="" class="h-full w-full object-contain" />
          </span>
          <div>
            <p class="text-sm font-semibold">{{ siteName }}</p>
            <p class="text-xs text-[#b2c4c0]">{{ siteSubtitle }}</p>
          </div>
        </div>

        <div class="relative max-w-xl">
          <p class="auth-kicker mb-4 font-mono text-xs uppercase">
            {{ siteSubtitle }}
          </p>
          <h1 class="break-words text-5xl font-medium leading-none tracking-tight xl:text-7xl">{{ siteName }}</h1>
        </div>

        <p class="relative font-mono text-xs text-[#b2c4c0]">&copy; {{ currentYear }} {{ siteName }}</p>
      </section>

      <section class="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div class="w-full max-w-[460px]">
          <div class="mb-8 flex items-center justify-between lg:hidden">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md">
                <img :src="siteLogo || '/logo.svg'" alt="" class="h-full w-full object-contain" />
              </span>
              <div>
                <p class="text-sm font-semibold">{{ siteName }}</p>
                <p class="text-xs text-[var(--geist-foreground-300)]">{{ siteSubtitle }}</p>
              </div>
            </div>
          </div>

          <Card class="auth-panel p-6 sm:p-8">
            <slot />
          </Card>

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
import { Card } from '@/components/ui/card'
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

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>

<style scoped>
.auth-shell {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
.auth-panel {
  border-color: hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 12px 38px -24px rgb(0 0 0 / .28);
}
.auth-mast {
  color: #eff4f1;
  background: linear-gradient(150deg, #192325, #0d1315 70%);
}
.auth-field {
  position: absolute;
  z-index: -1;
  inset: 16% -8% -4% 0;
  background: url('@/assets/auth-field.svg') center right / 110% auto no-repeat;
  opacity: .58;
  mask-image: linear-gradient(180deg, transparent 1%, #000 32%, #000 86%, transparent);
}
.auth-kicker {
  color: #c9dad4;
  letter-spacing: .1em;
}
.auth-kicker::before {
  display: inline-block;
  content: '';
  width: 1.6rem;
  height: 2px;
  margin-right: .65rem;
  vertical-align: middle;
  background: #a1d9bc;
}
</style>
