import { ref } from 'vue'
import { useAppStore } from '@/stores/app'

interface UseFormOptions<T> {
  form: T
  submitFn: (data: T) => Promise<void>
  successMsg?: string
  errorMsg?: string
}

/**
 * 統一表單提交邏輯
 * 管理載入狀態、錯誤捕獲及通知
 */
export function useForm<T>(options: UseFormOptions<T>) {
  const { form, submitFn, successMsg, errorMsg } = options
  const loading = ref(false)
  const appStore = useAppStore()

  const submit = async () => {
    if (loading.value) return
    
    loading.value = true
    try {
      await submitFn(form)
      if (successMsg) {
        appStore.showSuccess(successMsg)
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.response?.data?.message || error.message
      appStore.showError(errorMsg || detail)
      // 繼續丟擲錯誤，讓元件有機會進行區域性處理（如驗證錯誤顯示）
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    submit
  }
}
