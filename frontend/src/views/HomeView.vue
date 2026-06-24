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

  <div v-else ref="homeRoot" class="home-codex min-h-screen">
    <div class="home-backdrop" aria-hidden="true">
      <div class="desktop-grid"></div>
    </div>

    <header class="home-header" data-animate="header">
      <nav class="home-nav">
        <router-link to="/home" class="brand-lockup" aria-label="Home" data-animate="brand">
          <span class="brand-mark">
            <img :src="siteLogo || '/logo.png'" alt="" class="h-full w-full object-contain" />
          </span>
          <span class="truncate text-[15px] font-semibold">{{ brandName }}</span>
        </router-link>

        <div class="nav-links" data-animate="nav">
          <a href="#work" data-magnetic>{{ t('home.landing.nav.workflow') }}</a>
          <a href="#models" data-magnetic>{{ t('home.landing.nav.models') }}</a>
          <a href="#access" data-magnetic>{{ t('home.landing.nav.access') }}</a>
          <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" data-magnetic>
            {{ t('home.docs') }}
          </a>
        </div>

        <div class="nav-actions" data-animate="actions">
          <LocaleSwitcher />
          <button
            @click="toggleTheme"
            class="icon-button"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            data-button
          >
            <Icon v-if="isDark" name="sun" size="sm" />
            <Icon v-else name="moon" size="sm" />
          </button>
          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="pill-button pill-button-dark"
            data-button
          >
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main>
      <section class="hero-shell">
        <div class="hero-grid">
          <div class="hero-copy">
            <p class="eyebrow" data-animate="hero">Z30 API Gateway</p>
            <h1 data-animate="hero">{{ brandName }}</h1>
            <p class="hero-subtitle" data-animate="hero">{{ heroSubtitle }}</p>

            <div class="hero-actions" data-animate="hero">
              <a
                :href="rechargeUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="pill-button pill-button-dark"
                data-button
              >
                {{ t('home.landing.actions.rechargeNow') }}
                <Icon name="externalLink" size="sm" />
              </a>
              <router-link
                :to="isAuthenticated ? dashboardPath : '/login'"
                class="pill-button pill-button-light"
                data-button
              >
                {{ isAuthenticated ? t('home.landing.actions.openWorkspace') : t('home.getStarted') }}
                <Icon name="arrowRight" size="sm" />
              </router-link>
            </div>

            <div class="compat-row" data-animate="hero">
              <span v-for="logo in modelLogos" :key="logo.name" data-chip>{{ logo.name }}</span>
            </div>
          </div>

          <div class="hero-visual glass-panel" data-animate="visual" data-card>
            <div class="window-toolbar">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div class="visual-body">
              <div class="route-map">
                <canvas
                  ref="heroCanvas"
                  class="route-canvas"
                  :aria-label="t('home.landing.visualLabel')"
                  role="img"
                ></canvas>
                <div class="visual-labels" aria-hidden="true">
                  <span>Client</span>
                  <span>Z30 API</span>
                  <span>Models</span>
                </div>
              </div>

              <div class="metric-strip">
                <div v-for="metric in heroMetrics" :key="metric.label" class="metric-card" data-animate="metric" data-card>
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                  <small>{{ metric.detail }}</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="cta-glass glass-panel" data-animate="banner" data-card>
          <p>{{ t('home.landing.ctaBanner') }}</p>
          <a
            :href="rechargeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="pill-button pill-button-dark"
            data-button
          >
            {{ t('home.landing.actions.openRecharge') }}
            <Icon name="externalLink" size="sm" />
          </a>
        </div>
      </section>

      <section id="work" class="section-shell">
        <div class="section-heading" data-animate-scroll>
          <p class="eyebrow">Workflow</p>
          <h2>{{ t('home.landing.workflowTitle') }}</h2>
        </div>

        <div class="feature-grid">
          <article
            v-for="feature in features"
            :key="feature.title"
            class="feature-card glass-panel"
            data-animate-scroll
            data-card
          >
            <span class="feature-icon">
              <Icon :name="feature.icon" size="lg" />
            </span>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </article>
        </div>
      </section>

      <section id="models" class="section-shell section-tight">
        <div class="section-heading" data-animate-scroll>
          <p class="eyebrow">Models</p>
          <h2>{{ t('home.landing.modelsTitle') }}</h2>
        </div>

        <div class="provider-grid">
          <article
            v-for="provider in providers"
            :key="provider.name"
            class="provider-card glass-panel"
            data-animate-scroll
            data-card
          >
            <div>
              <h3>{{ provider.name }}</h3>
              <p>{{ provider.caption }}</p>
            </div>
            <span>{{ provider.status }}</span>
          </article>
        </div>
      </section>

      <section id="access" class="section-shell access-section">
        <div class="access-copy" data-animate-scroll>
          <p class="eyebrow">Access</p>
          <h2>{{ t('home.landing.accessTitle') }}</h2>
          <p>{{ t('home.landing.accessDescription') }}</p>
          <div class="hero-actions">
            <a
              :href="rechargeUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="pill-button pill-button-dark"
              data-button
            >
              {{ t('home.landing.actions.rechargeEntry') }}
              <Icon name="externalLink" size="sm" />
            </a>
            <router-link
              :to="isAuthenticated ? dashboardPath : '/login'"
              class="pill-button pill-button-light"
              data-button
            >
              {{ t('home.dashboard') }}
              <Icon name="arrowRight" size="sm" />
            </router-link>
          </div>
        </div>

        <div class="code-window glass-panel" data-animate-scroll data-card>
          <div class="window-toolbar">
            <span></span>
            <span></span>
            <span></span>
            <small>request.ts</small>
          </div>
          <div class="code-body">
            <p data-code-line><span>const</span> client = <strong>new</strong> OpenAI({</p>
            <p data-code-line>baseURL: <em>'https://z30.top/v1'</em>,</p>
            <p data-code-line>apiKey: <em>'sk-z30...'</em></p>
            <p data-code-line>})</p>
            <p data-code-line class="comment-line">OpenAI compatible gateway</p>
          </div>
        </div>
      </section>
    </main>

    <footer class="home-footer" data-animate-scroll>
      <p>&copy; {{ currentYear }} {{ brandName }}</p>
      <div>
        <a :href="siteUrl" target="_blank" rel="noopener noreferrer" data-magnetic>z30.top</a>
        <a :href="rechargeUrl" target="_blank" rel="noopener noreferrer" data-magnetic>{{ t('home.landing.nav.recharge') }}</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'

type HoverCleanup = () => void
type CanvasCleanup = () => void
type FeatureIcon = 'server' | 'shield' | 'chart' | 'key'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const homeRoot = ref<HTMLElement | null>(null)
const heroCanvas = ref<HTMLCanvasElement | null>(null)
const animationCleanups: HoverCleanup[] = []
let canvasCleanup: CanvasCleanup | undefined
let animationContext: ReturnType<typeof gsap.context> | undefined

const configuredSiteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || '')
const brandName = computed(() => {
  const value = configuredSiteName.value.trim()
  return value && value !== 'Sub2API' ? value : 'Z30 API'
})
const siteLogo = computed(() => appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '')
const heroSubtitle = computed(
  () =>
    appStore.cachedPublicSettings?.site_subtitle ||
    t('home.landing.heroSubtitle')
)
const docUrl = computed(() => appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')

const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

const isDark = ref(document.documentElement.classList.contains('dark'))
const siteUrl = 'https://z30.top'
const rechargeUrl = 'https://catfk.com/shop/Z30AI'

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

const heroMetrics = computed(() => [
  { label: 'Gateway', value: '99.9%', detail: t('home.landing.metrics.gateway') },
  { label: 'Billing', value: 'Usage', detail: t('home.landing.metrics.billing') },
  { label: 'Base URL', value: '/v1', detail: t('home.landing.metrics.baseUrl') }
])

const features = computed<Array<{ icon: FeatureIcon; title: string; description: string }>>(() => [
  {
    icon: 'server',
    title: t('home.landing.featureCards.gateway.title'),
    description: t('home.landing.featureCards.gateway.description')
  },
  {
    icon: 'shield',
    title: t('home.landing.featureCards.routing.title'),
    description: t('home.landing.featureCards.routing.description')
  },
  {
    icon: 'chart',
    title: t('home.landing.featureCards.usage.title'),
    description: t('home.landing.featureCards.usage.description')
  },
  {
    icon: 'key',
    title: t('home.landing.featureCards.keys.title'),
    description: t('home.landing.featureCards.keys.description')
  }
])

const providers = computed(() => [
  { name: 'Codex', caption: t('home.landing.providerCaptions.codex'), status: t('home.landing.providerStatus.ready') },
  { name: 'Claude', caption: t('home.landing.providerCaptions.claude'), status: t('home.landing.providerStatus.ready') },
  { name: 'GPT', caption: t('home.landing.providerCaptions.gpt'), status: t('home.landing.providerStatus.ready') },
  { name: 'Gemini', caption: t('home.landing.providerCaptions.gemini'), status: t('home.landing.providerStatus.ready') },
  { name: 'Antigravity', caption: t('home.landing.providerCaptions.antigravity'), status: t('home.landing.providerStatus.ready') },
  { name: 'More', caption: t('home.landing.providerCaptions.more'), status: t('home.landing.providerStatus.soon') }
])

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  requestAnimationFrame(() => {
    canvasCleanup?.()
    canvasCleanup = undefined
    initCanvasAnimation()
  })
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

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function drawRoundedCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke: string
) {
  roundedRectPath(context, x, y, width, height, radius)
  context.fillStyle = fill
  context.fill()
  context.strokeStyle = stroke
  context.lineWidth = 1
  context.stroke()
}

function drawNodeIcon(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  variant: 'client' | 'gateway' | 'models'
) {
  context.save()
  context.lineWidth = 4
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = color
  if (variant === 'client') {
    context.beginPath()
    context.moveTo(cx - 14, cy)
    context.lineTo(cx + 14, cy)
    context.moveTo(cx, cy - 14)
    context.lineTo(cx, cy + 14)
    context.stroke()
  } else if (variant === 'gateway') {
    context.fillStyle = color
    context.beginPath()
    context.arc(cx, cy, 5, 0, Math.PI * 2)
    context.fill()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6
      const x = cx + Math.cos(angle) * 23
      const y = cy + Math.sin(angle) * 23
      context.beginPath()
      context.moveTo(cx, cy)
      context.lineTo(x, y)
      context.stroke()
      context.beginPath()
      context.arc(x, y, 4, 0, Math.PI * 2)
      context.fill()
    }
  } else {
    for (let i = 0; i < 3; i++) {
      context.beginPath()
      context.arc(cx - 16 + i * 16, cy, 5, 0, Math.PI * 2)
      context.stroke()
    }
    context.beginPath()
    context.moveTo(cx - 11, cy)
    context.lineTo(cx - 5, cy)
    context.moveTo(cx + 5, cy)
    context.lineTo(cx + 11, cy)
    context.stroke()
  }
  context.restore()
}

function initCanvasAnimation() {
  const canvas = heroCanvas.value
  const container = canvas?.parentElement
  if (!canvas || !container) return

  const context = canvas.getContext('2d')
  if (!context) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let animationFrame = 0
  let running = true

  const render = (time = 0) => {
    const rect = container.getBoundingClientRect()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(320, rect.width)
    const height = Math.max(250, rect.height)

    if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)

    const dark = document.documentElement.classList.contains('dark')
    const progress = reduceMotion ? 0.36 : time * 0.00018
    const pulse = reduceMotion ? 0.5 : (Math.sin(time * 0.0016) + 1) / 2
    const primary = dark ? '#78a8ff' : '#2f7cf6'
    const teal = dark ? '#67e8d0' : '#1f9d8a'
    const amber = dark ? '#f7c66a' : '#f0a33a'
    const ink = dark ? '#f8fafc' : '#111827'
    const muted = dark ? 'rgba(248, 250, 252, 0.66)' : 'rgba(17, 24, 39, 0.62)'
    const panelFill = dark ? 'rgba(12, 16, 24, 0.76)' : 'rgba(255, 255, 255, 0.72)'
    const cardFill = dark ? 'rgba(22, 28, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)'
    const lineSoft = dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(17, 24, 39, 0.08)'

    const margin = width < 430 ? 18 : 26
    drawRoundedCard(context, margin, 20, width - margin * 2, height - 42, 28, panelFill, lineSoft)

    const nodes = [
      { x: width * 0.2, y: height * 0.52, w: 118, h: 92, label: 'Client', color: primary, variant: 'client' as const },
      { x: width * 0.5, y: height * 0.48 - pulse * 5, w: 134, h: 122, label: 'Z30 API', color: ink, variant: 'gateway' as const },
      { x: width * 0.8, y: height * 0.34, w: 126, h: 86, label: 'Models', color: teal, variant: 'models' as const },
      { x: width * 0.8, y: height * 0.68, w: 126, h: 86, label: 'Billing', color: amber, variant: 'models' as const }
    ]

    const drawBezier = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      colorA: string,
      colorB: string,
      offset: number
    ) => {
      const gradient = context.createLinearGradient(fromX, fromY, toX, toY)
      gradient.addColorStop(0, colorA)
      gradient.addColorStop(1, colorB)
      context.save()
      context.lineWidth = 3
      context.lineCap = 'round'
      context.strokeStyle = gradient
      context.setLineDash([12, 13])
      context.lineDashOffset = -((progress * 160 + offset) % 25)
      context.beginPath()
      context.moveTo(fromX, fromY)
      context.bezierCurveTo(width * 0.36, fromY - 76, width * 0.63, toY - 76, toX, toY)
      context.stroke()
      context.restore()

      for (let i = 0; i < 3; i++) {
        const p = (progress + offset * 0.01 + i / 3) % 1
        const inv = 1 - p
        const cx1 = width * 0.36
        const cy1 = fromY - 76
        const cx2 = width * 0.63
        const cy2 = toY - 76
        const x = inv ** 3 * fromX + 3 * inv ** 2 * p * cx1 + 3 * inv * p ** 2 * cx2 + p ** 3 * toX
        const y = inv ** 3 * fromY + 3 * inv ** 2 * p * cy1 + 3 * inv * p ** 2 * cy2 + p ** 3 * toY
        context.fillStyle = i % 2 ? colorB : colorA
        context.beginPath()
        context.arc(x, y, 3.5, 0, Math.PI * 2)
        context.fill()
      }
    }

    drawBezier(nodes[0].x + 48, nodes[0].y - 8, nodes[2].x - 54, nodes[2].y, primary, teal, 0)
    drawBezier(nodes[0].x + 48, nodes[0].y + 12, nodes[3].x - 54, nodes[3].y, primary, amber, 8)

    for (const node of nodes) {
      const x = node.x - node.w / 2
      const y = node.y - node.h / 2
      context.save()
      context.shadowColor = dark ? 'rgba(0, 0, 0, 0.34)' : 'rgba(31, 41, 55, 0.14)'
      context.shadowBlur = 22
      context.shadowOffsetY = 12
      drawRoundedCard(
        context,
        x,
        y,
        node.w,
        node.h,
        node.label === 'Z30 API' ? 28 : 22,
        node.label === 'Z30 API' ? (dark ? '#f8fafc' : '#111827') : cardFill,
        lineSoft
      )
      context.restore()

      const iconColor = node.label === 'Z30 API' ? (dark ? '#111827' : '#ffffff') : node.color
      drawNodeIcon(context, node.x, node.y - 12, iconColor, node.variant)
      context.fillStyle = node.label === 'Z30 API' ? (dark ? '#111827' : '#ffffff') : ink
      context.font = '700 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(node.label, node.x, node.y + node.h * 0.27)
    }

    context.fillStyle = muted
    context.font = '650 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    context.textAlign = 'left'
    context.fillText('OpenAI-compatible routing', margin + 24, height - 38)
    context.textAlign = 'right'
    context.fillText('live usage + failover', width - margin - 24, height - 38)

    if (running && !reduceMotion) {
      animationFrame = requestAnimationFrame(render)
    }
  }

  const resizeObserver = new ResizeObserver(() => render(performance.now()))
  resizeObserver.observe(container)

  render(performance.now())

  canvasCleanup = () => {
    running = false
    cancelAnimationFrame(animationFrame)
    resizeObserver.disconnect()
  }
}

function addHoverAnimation(element: Element, enterVars: gsap.TweenVars, leaveVars: gsap.TweenVars) {
  const onEnter = () => gsap.to(element, enterVars)
  const onLeave = () => gsap.to(element, leaveVars)

  element.addEventListener('mouseenter', onEnter)
  element.addEventListener('mouseleave', onLeave)
  animationCleanups.push(() => {
    element.removeEventListener('mouseenter', onEnter)
    element.removeEventListener('mouseleave', onLeave)
  })
}

function initHomeAnimations() {
  const root = homeRoot.value
  if (!root || homeContent.value) return

  gsap.registerPlugin(ScrollTrigger)

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  animationContext = gsap.context(() => {
    if (reduceMotion) {
      gsap.set('[data-animate], [data-animate-scroll], [data-chip], [data-code-line]', {
        clearProps: 'all'
      })
      return
    }

    const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    heroTimeline
      .from('[data-animate="header"]', { y: -18, opacity: 0, duration: 0.75 })
      .from('[data-animate="brand"], [data-animate="nav"], [data-animate="actions"]', {
        y: -10,
        opacity: 0,
        duration: 0.52,
        stagger: 0.08
      }, '-=0.42')
      .from('[data-animate="hero"]', {
        y: 28,
        opacity: 0,
        duration: 0.72,
        stagger: 0.09
      }, '-=0.18')
      .from('[data-animate="visual"]', {
        y: 34,
        rotateX: -6,
        opacity: 0,
        duration: 0.9,
        transformOrigin: '50% 80%'
      }, '-=0.48')
      .from('[data-animate="metric"]', {
        y: 18,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08
      }, '-=0.42')
      .from('[data-animate="banner"]', {
        y: 18,
        opacity: 0,
        duration: 0.62
      }, '-=0.18')

    gsap.from('[data-chip]', {
      opacity: 0,
      y: 12,
      duration: 0.46,
      stagger: 0.05,
      ease: 'power2.out',
      delay: 0.76
    })

    gsap.from('[data-code-line]', {
      x: -16,
      opacity: 0,
      duration: 0.42,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.code-window',
        start: 'top 75%'
      }
    })

    gsap.utils.toArray<HTMLElement>('[data-animate-scroll]').forEach((element) => {
      gsap.from(element, {
        y: 28,
        opacity: 0,
        duration: 0.72,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 84%'
        }
      })
    })

    gsap.utils.toArray<HTMLElement>('[data-card]').forEach((element) => {
      addHoverAnimation(
        element,
        { y: -6, scale: 1.01, duration: 0.28, ease: 'power2.out' },
        { y: 0, scale: 1, duration: 0.28, ease: 'power2.out' }
      )
    })

    gsap.utils.toArray<HTMLElement>('[data-button]').forEach((element) => {
      addHoverAnimation(
        element,
        { y: -2, scale: 1.02, duration: 0.22, ease: 'power2.out' },
        { y: 0, scale: 1, duration: 0.22, ease: 'power2.out' }
      )
    })

    gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((element) => {
      addHoverAnimation(
        element,
        { y: -2, duration: 0.2, ease: 'power2.out' },
        { y: 0, duration: 0.2, ease: 'power2.out' }
      )
    })
  }, root)
}

function cleanupAnimations() {
  animationCleanups.splice(0).forEach((cleanup) => cleanup())
  animationContext?.revert()
  animationContext = undefined
  canvasCleanup?.()
  canvasCleanup = undefined
}

onMounted(async () => {
  initTheme()
  authStore.checkAuth()

  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }

  await nextTick()
  initCanvasAnimation()
  initHomeAnimations()
})

onBeforeUnmount(() => {
  cleanupAnimations()
})
</script>

<style scoped>
.home-codex {
  position: relative;
  overflow: hidden;
  color: #15171c;
  background:
    linear-gradient(180deg, rgba(246, 248, 251, 0.96), rgba(236, 240, 246, 0.94)),
    #f5f7fa;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Display",
    "Segoe UI",
    sans-serif;
}

:global(.dark .home-codex){
  color: #f6f7fb;
  background:
    linear-gradient(180deg, rgba(26, 28, 34, 0.97), rgba(12, 14, 18, 0.98)),
    #0d0f14;
}

.home-backdrop {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 0;
}

.desktop-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(23, 28, 38, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 28, 38, 0.055) 1px, transparent 1px);
  background-position: center top;
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.88), transparent 72%);
}

:global(.dark .desktop-grid){
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, transparent 1px);
}

.home-header,
.hero-shell,
.section-shell,
.home-footer {
  position: relative;
  z-index: 1;
}

.home-header {
  position: fixed;
  inset: 14px 0 auto;
  z-index: 40;
  padding: 0 18px;
}

.home-nav {
  margin: 0 auto;
  display: flex;
  min-height: 58px;
  max-width: 1180px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.58);
  padding: 8px 10px 8px 14px;
  box-shadow: 0 18px 50px rgba(27, 31, 40, 0.08);
  backdrop-filter: blur(24px) saturate(1.35);
  -webkit-backdrop-filter: blur(24px) saturate(1.35);
}

:global(.dark .home-nav){
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(24, 27, 34, 0.62);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.34);
}

.brand-lockup,
.nav-actions,
.nav-links,
.pill-button,
.icon-button {
  display: inline-flex;
  align-items: center;
}

.brand-lockup {
  min-width: 0;
  gap: 10px;
}

.brand-mark {
  display: inline-flex;
  height: 36px;
  width: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.72), 0 8px 22px rgba(31, 41, 55, 0.12);
}

:global(.dark .brand-mark){
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 8px 22px rgba(0, 0, 0, 0.34);
}

.nav-links {
  gap: 8px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.34);
  padding: 5px;
}

.nav-links a,
.home-footer a {
  border-radius: 12px;
  padding: 8px 12px;
  color: rgba(21, 23, 28, 0.68);
  font-size: 13px;
  font-weight: 600;
  transition: color 160ms ease, background 160ms ease;
}

.nav-links a:hover,
.home-footer a:hover {
  background: rgba(255, 255, 255, 0.58);
  color: #15171c;
}

:global(.dark .nav-links){
  background: rgba(255, 255, 255, 0.06);
}

:global(.dark .nav-links a),
:global(.dark .home-footer a){
  color: rgba(246, 247, 251, 0.68);
}

:global(.dark .nav-links a:hover),
:global(.dark .home-footer a:hover){
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.nav-actions {
  flex-shrink: 0;
  gap: 8px;
}

.icon-button {
  height: 40px;
  width: 40px;
  justify-content: center;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: rgba(255, 255, 255, 0.54);
  color: rgba(21, 23, 28, 0.74);
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.icon-button:hover {
  border-color: rgba(17, 24, 39, 0.14);
  background: rgba(255, 255, 255, 0.76);
  color: #15171c;
}

:global(.dark .icon-button){
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(246, 247, 251, 0.76);
}

.pill-button {
  min-height: 42px;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  white-space: nowrap;
}

.pill-button-dark {
  border: 1px solid rgba(15, 23, 42, 0.92);
  background: #111827;
  color: #ffffff;
  box-shadow: 0 14px 32px rgba(17, 24, 39, 0.18);
}

.pill-button-dark:hover {
  background: #1f2937;
}

.pill-button-light {
  border: 1px solid rgba(255, 255, 255, 0.74);
  background: rgba(255, 255, 255, 0.56);
  color: #15171c;
}

.pill-button-light:hover {
  background: rgba(255, 255, 255, 0.82);
}

:global(.dark .pill-button-light){
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #f6f7fb;
}

.hero-shell {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  justify-content: center;
  gap: 30px;
  padding: 118px 20px 48px;
}

.hero-grid {
  margin: 0 auto;
  display: grid;
  width: min(1180px, 100%);
  align-items: center;
  gap: clamp(30px, 6vw, 70px);
  grid-template-columns: minmax(0, 0.92fr) minmax(390px, 1.08fr);
}

.hero-copy h1,
.section-heading h2,
.access-copy h2 {
  margin: 0;
  max-width: 780px;
  letter-spacing: 0;
  color: #111827;
}

:global(.dark .hero-copy h1),
:global(.dark .section-heading h2),
:global(.dark .access-copy h2){
  color: #ffffff;
}

.hero-copy h1 {
  margin-top: 14px;
  font-size: clamp(54px, 8vw, 108px);
  font-weight: 760;
  line-height: 0.95;
}

.hero-subtitle {
  margin-top: 24px;
  max-width: 650px;
  color: rgba(21, 23, 28, 0.68);
  font-size: clamp(18px, 2.1vw, 24px);
  line-height: 1.55;
}

:global(.dark .hero-subtitle),
:global(.dark .access-copy > p),
:global(.dark .feature-card p),
:global(.dark .provider-card p){
  color: rgba(246, 247, 251, 0.66);
}

.eyebrow {
  margin: 0;
  color: rgba(47, 124, 246, 0.9);
  font-size: 12px;
  font-weight: 760;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.hero-actions {
  margin-top: 30px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.compat-row {
  margin-top: 30px;
  display: flex;
  max-width: 600px;
  flex-wrap: wrap;
  gap: 10px;
}

.compat-row span,
.provider-card span {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: rgba(255, 255, 255, 0.5);
  color: rgba(21, 23, 28, 0.66);
  font-size: 12px;
  font-weight: 700;
}

.compat-row span {
  min-height: 34px;
  padding: 0 13px;
}

:global(.dark .compat-row span),
:global(.dark .provider-card span){
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(246, 247, 251, 0.7);
}

.glass-panel {
  border: 1px solid rgba(255, 255, 255, 0.74);
  background: rgba(255, 255, 255, 0.48);
  box-shadow: 0 30px 80px rgba(31, 41, 55, 0.12);
  backdrop-filter: blur(28px) saturate(1.32);
  -webkit-backdrop-filter: blur(28px) saturate(1.32);
}

:global(.dark .glass-panel){
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(28, 31, 39, 0.58);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.3);
}

.hero-visual {
  min-height: 520px;
  overflow: hidden;
  border-radius: 30px;
}

.window-toolbar {
  display: flex;
  height: 48px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.07);
  padding: 0 18px;
}

:global(.dark .window-toolbar){
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.window-toolbar span {
  display: block;
  height: 11px;
  width: 11px;
  border-radius: 50%;
}

.window-toolbar span:nth-child(1) {
  background: #ff5f57;
}

.window-toolbar span:nth-child(2) {
  background: #febc2e;
}

.window-toolbar span:nth-child(3) {
  background: #28c840;
}

.window-toolbar small {
  margin-left: auto;
  color: rgba(21, 23, 28, 0.42);
  font-size: 12px;
  font-weight: 700;
}

:global(.dark .window-toolbar small){
  color: rgba(246, 247, 251, 0.46);
}

.visual-body {
  padding: 20px;
}

.route-map {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: clamp(270px, 29vw, 340px);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0.2)),
    rgba(238, 242, 247, 0.5);
}

:global(.dark .route-map){
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(8, 10, 15, 0.42);
}

.route-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.visual-labels {
  pointer-events: none;
  position: absolute;
  inset: auto 22px 20px;
  display: flex;
  justify-content: space-between;
  color: rgba(21, 23, 28, 0.42);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:global(.dark .visual-labels){
  color: rgba(246, 247, 251, 0.4);
}

.metric-strip {
  margin-top: 16px;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card,
.feature-card,
.provider-card,
.code-window {
  border-radius: 24px;
}

.metric-card {
  display: grid;
  min-height: 118px;
  align-content: center;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.46);
  padding: 18px;
}

:global(.dark .metric-card){
  border-color: rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.06);
}

.metric-card span,
.metric-card small,
.provider-card p,
.feature-card p,
.access-copy > p {
  color: rgba(21, 23, 28, 0.6);
}

.metric-card span,
.metric-card small {
  font-size: 12px;
  font-weight: 650;
}

.metric-card strong {
  color: #111827;
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1;
}

:global(.dark .metric-card strong){
  color: #ffffff;
}

.cta-glass {
  margin: 0 auto;
  display: flex;
  width: min(1180px, 100%);
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-radius: 26px;
  padding: 18px 20px 18px 24px;
}

.cta-glass p {
  margin: 0;
  max-width: 720px;
  color: rgba(21, 23, 28, 0.7);
  font-size: 15px;
  line-height: 1.7;
}

:global(.dark .cta-glass p){
  color: rgba(246, 247, 251, 0.68);
}

.section-shell {
  margin: 0 auto;
  width: min(1180px, calc(100% - 40px));
  padding: 104px 0;
}

.section-tight {
  padding-top: 42px;
}

.section-heading {
  margin-bottom: 34px;
}

.section-heading h2,
.access-copy h2 {
  margin-top: 14px;
  max-width: 780px;
  font-size: clamp(34px, 5vw, 62px);
  font-weight: 740;
  line-height: 1.04;
}

.feature-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.feature-card {
  min-height: 244px;
  padding: 22px;
}

.feature-icon {
  display: inline-flex;
  height: 46px;
  width: 46px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(47, 124, 246, 0.1);
  color: #2f7cf6;
}

.feature-card h3,
.provider-card h3 {
  margin: 18px 0 0;
  color: #111827;
  font-size: 18px;
  font-weight: 740;
}

:global(.dark .feature-card h3),
:global(.dark .provider-card h3){
  color: #ffffff;
}

.feature-card p {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.75;
}

.provider-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.provider-card {
  display: flex;
  min-height: 132px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 22px;
}

.provider-card h3 {
  margin-top: 0;
  font-size: 23px;
}

.provider-card p {
  margin: 8px 0 0;
  font-size: 13px;
}

.provider-card span {
  padding: 6px 10px;
}

.access-section {
  display: grid;
  align-items: center;
  gap: clamp(24px, 5vw, 60px);
  grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
  padding-bottom: 118px;
}

.access-copy > p {
  margin: 22px 0 0;
  max-width: 560px;
  font-size: 16px;
  line-height: 1.8;
}

.code-window {
  overflow: hidden;
}

.code-body {
  padding: 26px;
  font-family: "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace;
  font-size: clamp(13px, 1.7vw, 15px);
  line-height: 1.9;
}

.code-body p {
  margin: 0;
  white-space: nowrap;
}

.code-body p:nth-child(2),
.code-body p:nth-child(3) {
  padding-left: 22px;
}

.code-body span {
  color: #6b7280;
}

.code-body strong {
  color: #2f7cf6;
  font-weight: 700;
}

.code-body em {
  color: #1f9d8a;
  font-style: normal;
}

.comment-line {
  margin-top: 16px !important;
  color: rgba(21, 23, 28, 0.46);
}

:global(.dark .comment-line),
:global(.dark .metric-card span),
:global(.dark .metric-card small){
  color: rgba(246, 247, 251, 0.5);
}

.home-footer {
  margin: 0 auto;
  display: flex;
  width: min(1180px, calc(100% - 40px));
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid rgba(17, 24, 39, 0.08);
  padding: 28px 0 40px;
  color: rgba(21, 23, 28, 0.56);
  font-size: 14px;
}

:global(.dark .home-footer){
  border-top-color: rgba(255, 255, 255, 0.1);
  color: rgba(246, 247, 251, 0.54);
}

.home-footer p {
  margin: 0;
}

.home-footer div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 980px) {
  .home-header {
    inset: 10px 0 auto;
    padding: 0 12px;
  }

  .home-nav {
    border-radius: 18px;
  }

  .nav-links {
    display: none;
  }

  .hero-shell {
    min-height: auto;
    padding-top: 104px;
  }

  .hero-grid,
  .access-section {
    grid-template-columns: 1fr;
  }

  .hero-visual {
    min-height: auto;
  }

  .feature-grid,
  .provider-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .home-header {
    inset: 8px 0 auto;
  }

  .home-nav {
    min-height: 56px;
    gap: 8px;
    padding: 8px;
  }

  .brand-lockup {
    max-width: 42vw;
  }

  .brand-mark {
    height: 34px;
    width: 34px;
    border-radius: 11px;
  }

  .nav-actions {
    gap: 6px;
  }

  .nav-actions :deep(.locale-switcher),
  .nav-actions :deep(select) {
    max-width: 96px;
  }

  .pill-button {
    min-height: 40px;
    padding: 0 14px;
    font-size: 13px;
  }

  .nav-actions .pill-button {
    padding: 0 13px;
  }

  .hero-shell {
    padding: 96px 14px 34px;
  }

  .hero-copy h1 {
    font-size: clamp(46px, 16vw, 64px);
  }

  .hero-actions,
  .cta-glass,
  .home-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-actions .pill-button,
  .cta-glass .pill-button {
    width: 100%;
  }

  .compat-row {
    gap: 8px;
  }

  .hero-visual,
  .cta-glass,
  .feature-card,
  .provider-card,
  .code-window {
    border-radius: 20px;
  }

  .visual-body {
    padding: 12px;
  }

  .route-map {
    border-radius: 18px;
    height: 260px;
  }

  .metric-strip,
  .feature-grid,
  .provider-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    min-height: 96px;
  }

  .section-shell {
    width: calc(100% - 28px);
    padding: 72px 0;
  }

  .section-tight {
    padding-top: 26px;
  }

  .feature-card {
    min-height: auto;
  }

  .code-body {
    overflow-x: auto;
    padding: 20px;
  }

  .home-footer {
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-codex *,
  .home-codex *::before,
  .home-codex *::after {
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
    animation-duration: 1ms !important;
  }
}
</style>
