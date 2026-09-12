<template>
  <AppLayout v-if="!modeReady">
    <div
      data-testid="monitor-mode-loading"
      class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    >
      <div
        v-for="i in 8"
        :key="i"
        class="h-72 animate-pulse rounded-[24px] bg-white/60 dark:bg-dark-800"
      />
    </div>
  </AppLayout>
  <ChannelStatusV1View v-else-if="isV1" />
  <ChannelStatusV2View v-else-if="isLegacyV2" />
  <ChannelStatusV3View v-else />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import AppLayout from '@/components/layout/AppLayout.vue'
import { isChannelMonitorV1Mode, isChannelMonitorV2Mode } from '@/utils/featureFlags'
import ChannelStatusV1View from './ChannelStatusV1View.vue'
import ChannelStatusV2View from './ChannelStatusV2View.vue'
import ChannelStatusV3View from './ChannelStatusV3View.vue'

const appStore = useAppStore()
const settingsAttempted = ref(false)

// Missing channel_monitor_mode is treated as v1. Do not mount V1 until public
// settings resolve, otherwise a V2 site briefly (or permanently) renders the
// V1 empty copy because V1 probes are disabled in V2 mode.
const modeReady = computed(() => appStore.publicSettingsLoaded || settingsAttempted.value)
const isV1 = computed(() => isChannelMonitorV1Mode())
// Keep V2 available as a low-risk rollback/diagnostic view without another backend flag.
const isLegacyV2 = computed(() => isChannelMonitorV2Mode() && new URLSearchParams(window.location.search).get('monitor_view') === 'v2')

onMounted(async () => {
  if (!appStore.publicSettingsLoaded) {
    await appStore.fetchPublicSettings()
  }
  settingsAttempted.value = true
})
</script>
