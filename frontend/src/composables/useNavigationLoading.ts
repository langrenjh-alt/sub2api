/**
 * 導航載入狀態組合式函式
 * 管理路由切換時的載入狀態，支援防閃爍邏輯
 */
import { ref, readonly, computed } from 'vue'

/**
 * 導航載入狀態管理
 *
 * 功能：
 * 1. 在路由切換時顯示載入狀態
 * 2. 快速導航（< 100ms）不顯示載入指示器（防閃爍）
 * 3. 導航取消時正確重置狀態
 */
export function useNavigationLoading() {
  // 內部載入狀態
  const _isLoading = ref(false)

  // 導航開始時間（用於防閃爍計算）
  let navigationStartTime: number | null = null

  // 防閃爍延遲計時器
  let showLoadingTimer: ReturnType<typeof setTimeout> | null = null

  // 是否應該顯示載入指示器（考慮防閃爍邏輯）
  const shouldShowLoading = ref(false)

  // 防閃爍延遲時間（毫秒）
  const ANTI_FLICKER_DELAY = 100

  /**
   * 清理計時器
   */
  const clearTimer = (): void => {
    if (showLoadingTimer !== null) {
      clearTimeout(showLoadingTimer)
      showLoadingTimer = null
    }
  }

  /**
   * 導航開始時呼叫
   */
  const startNavigation = (): void => {
    navigationStartTime = Date.now()
    _isLoading.value = true

    // 延遲顯示載入指示器，實現防閃爍
    clearTimer()
    showLoadingTimer = setTimeout(() => {
      if (_isLoading.value) {
        shouldShowLoading.value = true
      }
    }, ANTI_FLICKER_DELAY)
  }

  /**
   * 導航結束時呼叫
   */
  const endNavigation = (): void => {
    clearTimer()
    _isLoading.value = false
    shouldShowLoading.value = false
    navigationStartTime = null
  }

  /**
   * 導航取消時呼叫（比如快速連續點選不同連結）
   */
  const cancelNavigation = (): void => {
    clearTimer()
    // 保持載入狀態，因為新的導航會立即開始
    // 但重置導航開始時間
    navigationStartTime = null
  }

  /**
   * 重置所有狀態（用於測試）
   */
  const resetState = (): void => {
    clearTimer()
    _isLoading.value = false
    shouldShowLoading.value = false
    navigationStartTime = null
  }

  /**
   * 獲取導航持續時間（毫秒）
   */
  const getNavigationDuration = (): number | null => {
    if (navigationStartTime === null) {
      return null
    }
    return Date.now() - navigationStartTime
  }

  // 公開的載入狀態（只讀）
  const isLoading = computed(() => shouldShowLoading.value)

  // 內部載入狀態（用於測試，不考慮防閃爍）
  const isNavigating = readonly(_isLoading)

  return {
    isLoading,
    isNavigating,
    startNavigation,
    endNavigation,
    cancelNavigation,
    resetState,
    getNavigationDuration,
    // 匯出常量用於測試
    ANTI_FLICKER_DELAY
  }
}

// 建立單例例項，供全域性使用
let navigationLoadingInstance: ReturnType<typeof useNavigationLoading> | null = null

export function useNavigationLoadingState() {
  if (!navigationLoadingInstance) {
    navigationLoadingInstance = useNavigationLoading()
  }
  return navigationLoadingInstance
}

// 匯出重置函式（用於測試）
export function _resetNavigationLoadingInstance(): void {
  if (navigationLoadingInstance) {
    navigationLoadingInstance.resetState()
  }
  navigationLoadingInstance = null
}
