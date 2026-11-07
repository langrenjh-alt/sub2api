<template>
  <div class="app-shell min-h-screen">
    <div aria-hidden="true" class="app-grid pointer-events-none fixed inset-0"></div>

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
        <div class="w-full">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import '@/styles/admin-workspace.css'
import { useRoute } from 'vue-router'
import { computed, onMounted, provide } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const route = useRoute()
provide("adminSurface", computed(() => route?.meta?.requiresAdmin === true))
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
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.app-grid {
  /* A quiet coordinate field tying dense data views to the public masthead. */
  background-image: radial-gradient(hsl(var(--input) / .6) .7px, transparent .9px);
  background-size: 16px 16px;
  mask-image: linear-gradient(to bottom, black 4rem, transparent 25rem);
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
