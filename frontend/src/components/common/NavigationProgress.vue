<script setup lang="ts">
/**
 * 導航進度條元件
 * 在頁面頂部顯示載入進度，提供導航反饋
 */
import { computed } from 'vue'
import { useNavigationLoadingState } from '@/composables/useNavigationLoading'

const { isLoading } = useNavigationLoadingState()

// 進度條可見性
const isVisible = computed(() => isLoading.value)
</script>

<template>
  <Transition name="progress-fade">
    <div
      v-show="isVisible"
      class="navigation-progress"
      role="progressbar"
      aria-label="Loading"
      aria-valuenow="0"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="navigation-progress-bar" />
    </div>
  </Transition>
</template>

<style scoped>
.navigation-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 9999;
  overflow: hidden;
  background: transparent;
}

.navigation-progress-bar {
  height: 100%;
  width: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    theme('colors.primary.400') 20%,
    theme('colors.primary.500') 50%,
    theme('colors.primary.400') 80%,
    transparent 100%
  );
  animation: progress-slide 1.5s ease-in-out infinite;
}

/* 暗色模式下的進度條顏色 */
:root.dark .navigation-progress-bar {
  background: linear-gradient(
    90deg,
    transparent 0%,
    theme('colors.primary.500') 20%,
    theme('colors.primary.400') 50%,
    theme('colors.primary.500') 80%,
    transparent 100%
  );
}

/* 進度條滑動動畫 */
@keyframes progress-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 淡入淡出過渡 */
.progress-fade-enter-active {
  transition: opacity 0.15s ease-out;
}

.progress-fade-leave-active {
  transition: opacity 0.3s ease-out;
}

.progress-fade-enter-from,
.progress-fade-leave-to {
  opacity: 0;
}

/* 減少動畫模式 */
@media (prefers-reduced-motion: reduce) {
  .navigation-progress-bar {
    animation: progress-pulse 2s ease-in-out infinite;
  }

  @keyframes progress-pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
}
</style>
