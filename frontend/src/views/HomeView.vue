<template>
  <div v-if="homeContent" class="min-h-screen">
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <div v-else v-html="homeContent"></div>
  </div>

  <div v-else class="home-codex min-h-screen bg-[#f4f3ee] text-[#111111] dark:bg-[#101010] dark:text-white">
    <header class="fixed inset-x-0 top-0 z-30 bg-[#f4f3ee]/90 backdrop-blur-md dark:bg-[#101010]/88">
      <nav class="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <router-link to="/home" class="flex min-w-0 items-center gap-3" aria-label="Home">
          <span class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-black text-white dark:bg-white dark:text-black">
            <img :src="siteLogo || '/logo.png'" alt="" class="h-full w-full object-contain" />
          </span>
          <span class="truncate text-[17px] font-semibold tracking-[-0.01em]">{{ brandName }}</span>
        </router-link>

        <div class="hidden items-center gap-8 text-sm text-black/70 dark:text-white/70 lg:flex">
          <a href="#work" class="transition hover:text-black dark:hover:text-white">工作方式</a>
          <a href="#models" class="transition hover:text-black dark:hover:text-white">模型</a>
          <a href="#access" class="transition hover:text-black dark:hover:text-white">接入</a>
          <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" class="transition hover:text-black dark:hover:text-white">
            文档
          </a>
        </div>

        <div class="flex items-center gap-2">
          <LocaleSwitcher />
          <button
            @click="toggleTheme"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/75 transition hover:bg-black/5 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
            :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
          >
            <Icon v-if="isDark" name="sun" size="sm" />
            <Icon v-else name="moon" size="sm" />
          </button>
          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="inline-flex h-10 items-center rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/85"
          >
            {{ isAuthenticated ? '进入控制台' : '登录' }}
          </router-link>
        </div>
      </nav>
    </header>

    <main>
      <section class="relative flex min-h-screen flex-col overflow-hidden px-5 pb-8 pt-28 sm:px-8">
        <div class="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
          <div class="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center text-center">
            <h1 class="text-[64px] font-semibold leading-[0.95] tracking-normal text-black dark:text-white sm:text-[86px] lg:text-[108px]">
              {{ brandName }}
            </h1>
            <p class="mt-7 max-w-3xl text-xl leading-8 text-black/78 dark:text-white/72 sm:text-2xl sm:leading-9">
              {{ heroSubtitle }}
            </p>

            <div class="mt-9 flex flex-col items-center gap-4 sm:flex-row">
              <a
                :href="rechargeUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-black px-7 text-sm font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/85"
              >
                领取优惠
                <Icon name="externalLink" size="sm" />
              </a>
              <router-link
                :to="isAuthenticated ? dashboardPath : '/login'"
                class="inline-flex h-12 items-center justify-center rounded-full bg-black/[0.04] px-7 text-sm font-semibold text-black transition hover:bg-black/[0.08] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                {{ isAuthenticated ? '打开工作台' : '开始使用' }}
              </router-link>
            </div>

            <p class="mt-8 text-sm text-black/55 dark:text-white/50">
              可用于 Codex、Claude、Gemini 和 OpenAI 兼容客户端
            </p>
          </div>

          <div class="mx-auto grid w-full max-w-2xl grid-cols-2 gap-x-12 gap-y-12 pb-16 text-center sm:max-w-3xl sm:grid-cols-4">
            <div v-for="logo in modelLogos" :key="logo.name" class="text-2xl font-bold tracking-tight text-black dark:text-white">
              {{ logo.name }}
            </div>
          </div>

          <div class="mx-auto w-full max-w-[1320px] rounded-md bg-black/[0.035] p-6 dark:bg-white/[0.06] sm:p-8">
            <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <p class="max-w-3xl text-base leading-7 text-black/75 dark:text-white/70">
                团队开始使用 {{ brandName }}，即可通过统一入口管理额度、密钥和多模型调用。
              </p>
              <a
                :href="rechargeUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-12 w-fit items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/85"
              >
                立即充值
                <Icon name="externalLink" size="sm" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="work" class="border-y border-black/10 bg-[#f7f7f4] py-24 dark:border-white/10 dark:bg-[#151515]">
        <div class="mx-auto grid max-w-[1320px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p class="text-sm text-black/50 dark:text-white/50">Work</p>
            <h2 class="mt-4 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              把 API 中转变成清晰的日常工作流。
            </h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <article
              v-for="feature in features"
              :key="feature.title"
              class="rounded-md border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <Icon :name="feature.icon" size="lg" class="mb-6 text-black/65 dark:text-white/65" />
              <h3 class="text-lg font-semibold">{{ feature.title }}</h3>
              <p class="mt-3 text-sm leading-6 text-black/62 dark:text-white/60">{{ feature.description }}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="models" class="bg-[#f4f3ee] py-24 dark:bg-[#101010]">
        <div class="mx-auto max-w-[1320px] px-5 sm:px-8">
          <div class="mb-12 max-w-3xl">
            <p class="text-sm text-black/50 dark:text-white/50">Models</p>
            <h2 class="mt-4 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              一个 Key，连接主流 AI 能力。
            </h2>
          </div>

          <div class="grid border-t border-black/10 dark:border-white/10 md:grid-cols-3">
            <div
              v-for="provider in providers"
              :key="provider.name"
              class="border-b border-black/10 py-8 md:border-r md:px-7 md:last:border-r-0 dark:border-white/10"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-2xl font-semibold">{{ provider.name }}</h3>
                  <p class="mt-2 text-sm text-black/55 dark:text-white/50">{{ provider.caption }}</p>
                </div>
                <span class="rounded-full border border-black/10 px-3 py-1 text-xs text-black/55 dark:border-white/15 dark:text-white/55">
                  {{ provider.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="access" class="bg-[#111111] py-24 text-white">
        <div class="mx-auto grid max-w-[1320px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p class="text-sm text-white/50">Access</p>
            <h2 class="mt-4 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              从充值到调用，路径保持简单。
            </h2>
            <p class="mt-6 max-w-xl text-base leading-7 text-white/62">
              充值后在控制台创建 API Key，把客户端 Base URL 指向 z30.top 的兼容接口，即可按原有 OpenAI SDK 方式调用。
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                :href="rechargeUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                充值入口
                <Icon name="externalLink" size="sm" />
              </a>
              <router-link
                :to="isAuthenticated ? dashboardPath : '/login'"
                class="inline-flex h-12 items-center justify-center rounded-full bg-white/10 px-6 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                控制台
              </router-link>
            </div>
          </div>

          <div class="rounded-md border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div class="rounded-md bg-black p-5 font-mono text-sm text-white">
              <div class="mb-5 flex items-center justify-between text-xs text-white/45">
                <span>request.ts</span>
                <span>OpenAI compatible</span>
              </div>
              <p><span class="text-white/45">const</span> client = <span class="text-sky-300">new</span> OpenAI({</p>
              <p class="pl-4">baseURL: <span class="text-emerald-300">'https://z30.top/v1'</span>,</p>
              <p class="pl-4">apiKey: <span class="text-emerald-300">'sk-z30...'</span></p>
              <p>})</p>
              <p class="mt-5 text-white/45"># Codex / Claude / Gemini through one key</p>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div v-for="metric in heroMetrics" :key="metric.label" class="rounded-md border border-white/10 p-4">
                <p class="text-xs text-white/45">{{ metric.label }}</p>
                <p class="mt-2 text-2xl font-semibold">{{ metric.value }}</p>
                <p class="mt-1 text-xs text-white/45">{{ metric.detail }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="bg-[#f4f3ee] px-5 py-8 dark:bg-[#101010] sm:px-8">
      <div class="mx-auto flex max-w-[1320px] flex-col gap-4 text-sm text-black/55 dark:text-white/55 md:flex-row md:items-center md:justify-between">
        <p>&copy; {{ currentYear }} {{ brandName }}</p>
        <div class="flex flex-wrap items-center gap-5">
          <a :href="siteUrl" target="_blank" rel="noopener noreferrer" class="transition hover:text-black dark:hover:text-white">z30.top</a>
          <a :href="rechargeUrl" target="_blank" rel="noopener noreferrer" class="transition hover:text-black dark:hover:text-white">充值</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'

const authStore = useAuthStore()
const appStore = useAppStore()

const configuredSiteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || '')
const brandName = computed(() => {
  const value = configuredSiteName.value.trim()
  return value && value !== 'Sub2API' ? value : 'Z30 API'
})
const siteLogo = computed(() => appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '')
const heroSubtitle = computed(
  () =>
    appStore.cachedPublicSettings?.site_subtitle ||
    '面向 Codex / Claude / Gemini 的统一 API 中转与额度管理平台，由 z30.top 提供稳定接入。'
)
const docUrl = computed(() => appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')

const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

const isDark = ref(document.documentElement.classList.contains('dark'))
const siteUrl = 'https://z30.top'
const rechargeUrl = 'https://pay.ldxp.cn/shop/ECMLPMHB'

const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))
const currentYear = computed(() => new Date().getFullYear())

const modelLogos = [
  { name: 'Codex' },
  { name: 'Claude' },
  { name: 'Gemini' },
  { name: 'OpenAI' }
]

const heroMetrics = [
  { label: 'Gateway', value: '99.9%', detail: '多账号容灾' },
  { label: 'Billing', value: 'Usage', detail: '额度可见' },
  { label: 'Base URL', value: '/v1', detail: '兼容 OpenAI' }
]

const features = [
  {
    icon: 'server',
    title: '统一网关',
    description: '保持 OpenAI 兼容调用方式，用同一套 Base URL 和 API Key 接入多种上游模型。'
  },
  {
    icon: 'shield',
    title: '稳定调度',
    description: '自动选择可用账号和通道，支持会话保持、负载切换和失败降级。'
  },
  {
    icon: 'chart',
    title: '用量可见',
    description: '余额、Token、请求量和成本集中呈现，团队使用情况清晰可查。'
  },
  {
    icon: 'key',
    title: '密钥管理',
    description: '为不同项目创建独立密钥，按场景控制额度、权限和使用周期。'
  }
] as const

const providers = [
  { name: 'Codex', caption: 'coding agent', status: 'ready' },
  { name: 'Claude', caption: 'messages API', status: 'ready' },
  { name: 'GPT', caption: 'OpenAI compatible', status: 'ready' },
  { name: 'Gemini', caption: 'v1beta support', status: 'ready' },
  { name: 'Antigravity', caption: 'dedicated routes', status: 'ready' },
  { name: 'More', caption: 'extendable upstreams', status: 'soon' }
]

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme')
  if (
    savedTheme === 'dark' ||
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
}

onMounted(() => {
  initTheme()
  authStore.checkAuth()

  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
})
</script>
