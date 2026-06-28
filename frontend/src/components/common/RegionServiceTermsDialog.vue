<template>
  <BaseDialog
    :show="showDialog"
    title="地区服务条款 / Regional Service Terms"
    width="extra-wide"
    :close-on-escape="false"
    :close-on-click-outside="false"
    :show-close-button="false"
    :z-index="170"
  >
    <div class="space-y-5">
      <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        <div class="flex gap-3">
          <Icon name="exclamationTriangle" size="md" class="mt-0.5 flex-shrink-0" />
          <div class="space-y-2">
            <p class="font-semibold">请先勾选同意后，才能继续进入登录 / 注册</p>
            <p class="leading-6">
              本弹窗同时提供繁體中文、简体中文与 English 三个版本；当您注册、登录、创建 API Key 或使用本平台 API 服务，即视为同意并承诺遵守相关条款。
            </p>
          </div>
        </div>
      </div>

      <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary-200 dark:border-dark-700 dark:bg-dark-900">
        <input
          v-model="consentChecked"
          type="checkbox"
          class="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-dark-600 dark:bg-dark-900"
        />
        <span class="text-sm leading-6 text-gray-700 dark:text-dark-200">
          我已阅读并同意以上三种语言版本的地区服务条款，并确认在继续前已理解相关内容。
        </span>
      </label>

      <div class="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
        <section
          v-for="section in termsSections"
          :key="section.key"
          class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900"
        >
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
              {{ section.title }}
            </span>
          </div>

          <div class="mt-4 space-y-3 text-sm leading-7 text-gray-700 dark:text-dark-200">
            <p v-for="(paragraph, index) in section.paragraphs" :key="`${section.key}-${index}`">
              {{ paragraph }}
            </p>
          </div>
        </section>
      </div>

      <p class="text-xs leading-5 text-gray-500 dark:text-dark-400">
        只有勾选同意后，按钮才可点击；同意后会在本浏览器中记录当前版本的条款确认状态。
      </p>
    </div>

    <template #footer>
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          :disabled="!consentChecked"
          :class="[
            'inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition',
            consentChecked ? 'bg-primary-600 hover:bg-primary-700' : 'cursor-not-allowed bg-primary-400'
          ]"
          @click="acceptTerms"
        >
          {{ consentChecked ? '同意并继续 / Agree & Continue' : '请先勾选同意 / Check to Continue' }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  REGION_SERVICE_TERMS_REVISION,
  REGION_SERVICE_TERMS_SECTIONS,
  isRegionServiceTermsRoute,
  readRegionServiceTermsConsentRevision,
  saveRegionServiceTermsConsentRevision
} from './regionServiceTerms'

const route = useRoute()
const consentRevision = ref<string | null>(readRegionServiceTermsConsentRevision())
const consentChecked = ref(false)

const termsSections = REGION_SERVICE_TERMS_SECTIONS

const showDialog = computed(
  () => isRegionServiceTermsRoute(route.path) && consentRevision.value !== REGION_SERVICE_TERMS_REVISION
)

watch(showDialog, (visible) => {
  if (visible) {
    consentChecked.value = false
  }
})

function acceptTerms(): void {
  if (!consentChecked.value) {
    return
  }
  consentRevision.value = REGION_SERVICE_TERMS_REVISION
  saveRegionServiceTermsConsentRevision(REGION_SERVICE_TERMS_REVISION)
}
</script>
