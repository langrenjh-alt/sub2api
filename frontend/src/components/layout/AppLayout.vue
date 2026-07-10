<template>
  <div class="app-shell min-h-screen">
    <div class="app-grid pointer-events-none fixed inset-0"></div>

    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main Content Area -->
    <div
      class="app-main relative min-h-screen transition-all duration-300"
      :class="[sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64']"
    >
      <!-- Header -->
      <AppHeader />

      <!-- Main Content -->
      <main class="app-content relative px-4 py-5 md:px-6 md:py-6 lg:px-8">
        <div class="mx-auto w-full max-w-[1600px]">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const appStore = useAppStore()
const authStore = useAuthStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
</script>

<style scoped>
.app-shell {
  background: var(--geist-background-200);
  color: var(--geist-foreground-100);
}

.app-grid {
  background-image:
    linear-gradient(var(--geist-border-100) 1px, transparent 1px),
    linear-gradient(90deg, var(--geist-border-100) 1px, transparent 1px);
  background-size: 64px 64px;
  opacity: 0.32;
  mask-image: linear-gradient(to bottom, black, transparent 420px);
}

.app-main {
  isolation: isolate;
}

.app-content {
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .app-main { transition-duration: 1ms; }
}
</style>
