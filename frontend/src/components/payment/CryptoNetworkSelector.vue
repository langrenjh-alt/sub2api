<template>
  <div>
    <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ t('payment.cryptoNetwork') }}
    </label>
    <div
      data-testid="crypto-network-grid"
      class="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <button
        v-for="network in networks"
        :key="network"
        type="button"
        :title="networkTitle(network)"
        :class="[
          'relative flex h-[64px] min-w-0 flex-col items-center justify-center rounded-lg border px-3 transition-all',
          selected === network
            ? networkSelectedClass(network)
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-200 dark:hover:border-dark-500',
        ]"
        @click="emit('select', network)"
      >
        <span class="flex items-center gap-1.5">
          <span :class="['h-2.5 w-2.5 rounded-full', networkDotClass(network)]" />
          <span class="text-sm font-semibold">{{ t(`payment.networks.${network}`, network.toUpperCase()) }}</span>
        </span>
        <span class="mt-1 text-[10px] tracking-wide text-gray-500 dark:text-dark-400">
          {{ t(`payment.networkTokens.${network}`, 'USDT') }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { BEpusdtNetwork } from './providerConfig'

defineProps<{
  networks: BEpusdtNetwork[]
  selected: string
}>()

const emit = defineEmits<{
  select: [network: string]
}>()

const { t } = useI18n()

function networkTitle(network: string): string {
  return `${t(`payment.networks.${network}`, network.toUpperCase())} ${t(`payment.networkTokens.${network}`, 'USDT')}`
}

function networkDotClass(network: string): string {
  switch (network) {
    case 'tron':
      return 'bg-[#FF0013]'
    case 'bsc':
      return 'bg-[#F0B90B]'
    case 'eth':
      return 'bg-[#627EEA]'
    case 'sol':
      return 'bg-[#9945FF]'
    default:
      return 'bg-primary-500'
  }
}

function networkSelectedClass(network: string): string {
  switch (network) {
    case 'tron':
      return 'border-[#FF0013] bg-red-50 text-gray-900 shadow-sm dark:bg-red-950 dark:text-gray-100'
    case 'bsc':
      return 'border-[#F0B90B] bg-amber-50 text-gray-900 shadow-sm dark:bg-amber-950 dark:text-gray-100'
    case 'eth':
      return 'border-[#627EEA] bg-indigo-50 text-gray-900 shadow-sm dark:bg-indigo-950 dark:text-gray-100'
    case 'sol':
      return 'border-[#9945FF] bg-purple-50 text-gray-900 shadow-sm dark:bg-purple-950 dark:text-gray-100'
    default:
      return 'border-primary-500 bg-primary-50 text-gray-900 shadow-sm dark:bg-primary-950 dark:text-gray-100'
  }
}

</script>
