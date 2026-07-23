<template>
  <div v-if="captchaId" class="geetest-wrapper">
    <div ref="containerRef" class="geetest-container"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GeetestValidation } from '@/types'

interface GeetestConfig {
  captchaId: string
  product: 'float'
  language: 'zho' | 'eng'
  timeout: number
  protocol: 'https://'
  onError: (error: GeetestError) => void
  nativeButton: {
    width: string
    height: string
  }
}

interface GeetestError {
  code?: string
  msg?: string
}

interface GeetestInstance {
  appendTo: (container: HTMLElement | string) => void
  getValidate: () => GeetestValidation | false
  onReady: (callback: () => void) => GeetestInstance
  onSuccess: (callback: () => void) => GeetestInstance
  onFail: (callback: () => void) => GeetestInstance
  onError: (callback: (error: GeetestError) => void) => GeetestInstance
  onClose: (callback: () => void) => GeetestInstance
  reset: () => void
  destroy: () => void
}

type InitGeetest4 = (
  config: GeetestConfig,
  callback: (instance: GeetestInstance) => void
) => void

declare global {
  interface Window {
    initGeetest4?: InitGeetest4
  }
}

const GEETEST_SCRIPT_URLS = [
  'https://static.geetest.com/v4/gt4.js',
  'https://static.geevisit.com/v4/gt4.js'
] as const
let geetestScriptPromise: Promise<void> | null = null

function loadGeetestScriptURL(url: string): Promise<void> {
  if (window.initGeetest4) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`)
    existingScript?.remove()

    const script = document.createElement('script')
    script.src = url
    script.async = true

    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeoutId)
      script.remove()
      reject(error)
    }
    const timeoutId = window.setTimeout(() => {
      if (window.initGeetest4) {
        settled = true
        resolve()
        return
      }
      fail(new Error(`Timed out while loading GeeTest v4 script from ${url}`))
    }, 10000)

    const onLoad = () => {
      if (settled) {
        return
      }
      if (window.initGeetest4) {
        settled = true
        window.clearTimeout(timeoutId)
        resolve()
        return
      }
      fail(new Error(`GeeTest v4 script from ${url} loaded without initGeetest4`))
    }
    const onError = () => {
      fail(new Error(`Failed to load GeeTest v4 script from ${url}`))
    }

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    document.head.appendChild(script)
  })
}

function loadGeetestScript(): Promise<void> {
  if (window.initGeetest4) {
    return Promise.resolve()
  }

  if (geetestScriptPromise) {
    return geetestScriptPromise
  }

  geetestScriptPromise = (async () => {
    let lastError: unknown
    for (const url of GEETEST_SCRIPT_URLS) {
      try {
        await loadGeetestScriptURL(url)
        return
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to load GeeTest v4 script')
  })().finally(() => {
    geetestScriptPromise = null
  })

  return geetestScriptPromise
}

const props = defineProps<{
  captchaId: string
}>()

const emit = defineEmits<{
  (event: 'verify', validation: GeetestValidation): void
  (event: 'invalid'): void
  (event: 'error'): void
}>()

const { locale } = useI18n()
const containerRef = ref<HTMLElement | null>(null)
const widget = ref<GeetestInstance | null>(null)
let initializationVersion = 0

const language = computed<'zho' | 'eng'>(() =>
  String(locale.value).toLowerCase().startsWith('zh') ? 'zho' : 'eng'
)

function destroyWidget(notifyInvalid = false): void {
  if (!widget.value) {
    return
  }
  try {
    widget.value.destroy()
  } catch {
    // The SDK may already have removed its DOM during navigation.
  }
  widget.value = null
  if (notifyInvalid) {
    emit('invalid')
  }
}

function isCompleteValidation(value: GeetestValidation | false): value is GeetestValidation {
  return Boolean(
    value &&
      value.lot_number &&
      value.captcha_output &&
      value.pass_token &&
      value.gen_time
  )
}

async function renderWidget(): Promise<void> {
  const version = ++initializationVersion
  destroyWidget(true)

  if (!props.captchaId || !containerRef.value) {
    return
  }

  containerRef.value.innerHTML = ''

  try {
    await loadGeetestScript()
    if (version !== initializationVersion || !containerRef.value || !window.initGeetest4) {
      return
    }

    window.initGeetest4(
      {
        captchaId: props.captchaId,
        product: 'float',
        language: language.value,
        timeout: 10000,
        protocol: 'https://',
        onError: () => {
          if (version === initializationVersion) {
            emit('error')
          }
        },
        nativeButton: {
          width: '100%',
          height: '50px'
        }
      },
      (instance) => {
        if (version !== initializationVersion || !containerRef.value) {
          instance.destroy()
          return
        }

        widget.value = instance
        instance.appendTo(containerRef.value)
        instance.onSuccess(() => {
          if (version !== initializationVersion) {
            return
          }
          const validation = instance.getValidate()
          if (!isCompleteValidation(validation)) {
            emit('error')
            return
          }
          emit('verify', validation)
        })
        instance.onFail(() => {
          if (version !== initializationVersion) {
            return
          }
          emit('invalid')
        })
        instance.onError(() => {
          if (version !== initializationVersion) {
            return
          }
          emit('error')
        })
        instance.onClose(() => {
          if (version !== initializationVersion) {
            return
          }
          emit('invalid')
        })
      }
    )
  } catch (error) {
    console.error('Failed to initialize GeeTest v4:', error)
    if (version === initializationVersion) {
      emit('error')
    }
  }
}

function reset(): void {
  if (!widget.value) {
    return
  }
  widget.value.reset()
  emit('invalid')
}

defineExpose({ reset })

onMounted(() => {
  void renderWidget()
})

onUnmounted(() => {
  initializationVersion++
  destroyWidget()
})

watch([() => props.captchaId, language], () => {
  void renderWidget()
})
</script>

<style scoped>
.geetest-wrapper,
.geetest-container {
  width: 100%;
}

.geetest-container {
  min-height: 50px;
}
</style>
