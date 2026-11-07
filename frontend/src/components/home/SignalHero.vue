<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { HomepageStatusResponse } from '@/api/homepageStatus'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { Button } from '@/components/ui/button'
import GlassWordmark from './GlassWordmark.vue'
import JourneyWorld from './JourneyWorld.vue'
import JourneyChapters from './JourneyChapters.vue'
import { currentFlightStop, flightProgress, flightStops, phase } from './journey/path'

defineProps<{
  brandName: string; siteLogo: string; tagline: string; workspacePath: string
  authenticated: boolean; modelPlaza: boolean; baseUrl: string; docUrl: string
  rechargeUrl: string; status: HomepageStatusResponse | null
  statusState: 'loading' | 'ready' | 'error'
  sampleMs: number | null
  customEndpoints: Array<{ name: string; endpoint: string; description?: string }>
}>()
const emit = defineEmits<{ refresh: [] }>()
const { t } = useI18n()
const runway = ref<HTMLElement>()
const stage = ref<HTMLElement>()
const progress = ref(0)
const pointerX = ref(0), pointerY = ref(0)
const paused = ref(false), reduced = ref(false), visible = ref(true), inView = ref(true)
const still = computed(() => paused.value || reduced.value)
const active = computed(() => !still.value && visible.value && inView.value)
const index = computed(() => currentFlightStop(progress.value))
const logoStyle = computed(() => {
  const p = progress.value
  if (still.value) return { opacity: p < 0.165 ? 1 : 0 }
  const near = phase(0.006, 0.215, p)
  return {
    opacity: 1 - phase(0.085, 0.195, p),
    transform: `translate(calc(-50% - ${near * 23}vw), calc(-50% + ${near * 16}svh)) scale(${1 + near * 2.9})`,
  }
})
const anchors = [
  ...flightStops,
  { id: 'actions', point: 0.445 }, { id: 'compatibility', point: 0.445 },
  { id: 'capabilities', point: 0.23 }, { id: 'access', point: 0.66 },
  { id: 'status', point: 0.94 },
]
let queued = 0
let mq: MediaQueryList | undefined
let io: IntersectionObserver | undefined
let ro: ResizeObserver | undefined
function sample() {
  queued = 0
  if (runway.value && stage.value) {
    const box = runway.value.getBoundingClientRect()
    progress.value = flightProgress(box.top, box.height, stage.value.offsetHeight)
  }
}
function queue() {
  if (!queued) queued = window.requestAnimationFrame(sample)
}
function resetPointer() { pointerX.value = 0; pointerY.value = 0 }
function sync() {
  reduced.value = mq?.matches ?? false; visible.value = !document.hidden
  if (reduced.value) resetPointer()
}
function point(e: PointerEvent) {
  if (!active.value || e.pointerType === 'touch' || !stage.value) return
  const b = stage.value.getBoundingClientRect()
  pointerX.value = 2 * (e.clientX - b.left) / Math.max(1, b.width) - 1
  pointerY.value = 2 * (e.clientY - b.top) / Math.max(1, b.height) - 1
}
onMounted(() => {
  mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  sync(); sample()
  mq.addEventListener?.('change', sync)
  document.addEventListener('visibilitychange', sync)
  window.addEventListener('scroll', queue, { passive: true })
  window.addEventListener('resize', queue)
  window.addEventListener('pageshow', queue)
  if ('ResizeObserver' in window && runway.value && stage.value) {
    ro = new ResizeObserver(queue); ro.observe(runway.value); ro.observe(stage.value)
  }
  if ('IntersectionObserver' in window && stage.value) {
    io = new IntersectionObserver(([e]) => { inView.value = e.isIntersecting }); io.observe(stage.value)
  }
})
onBeforeUnmount(() => {
  if (queued) cancelAnimationFrame(queued)
  io?.disconnect(); ro?.disconnect(); mq?.removeEventListener?.('change', sync)
  document.removeEventListener('visibilitychange', sync)
  window.removeEventListener('scroll', queue)
  window.removeEventListener('resize', queue)
  window.removeEventListener('pageshow', queue)
})
</script>

<template>
  <main ref="runway" class="z30-home home-intro-sequence">
    <!-- Real anchors outside the sticky stage support hash links, touch, keyboard,
         page search and history without trapping wheel events. -->
    <span v-for="stop in anchors" :id="stop.id" :key="stop.id" class="flight-anchor"
      :style="{ top: `calc(${stop.point * 100}% - ${stop.point * 100}svh)` }" aria-hidden="true"></span>
    <div ref="stage" class="signal" :data-motion="active ? 'on' : 'off'"
      :data-stop="flightStops[index].id" :data-progress="progress.toFixed(4)"
      @pointermove="point" @pointerleave="resetPointer">
      <img class="signal-plate" src="/assets/home/z30-signal-field.webp" alt="" fetchpriority="high" />
      <JourneyWorld :progress="progress" :active="active" :reduced="still" :pointer-x="pointerX" :pointer-y="pointerY" />

      <div class="signal-core" :style="logoStyle" :aria-hidden="progress > .2 ? true : undefined">
        <GlassWordmark :travel="still ? 0 : phase(0.015, 0.18, progress) * .8" :active="active && progress < .21" :pointer-x="pointerX" :pointer-y="pointerY" />
      </div>
      <JourneyChapters :progress="progress" :reduced="still" :model-plaza="modelPlaza"
        :workspace-path="workspacePath" :base-url="baseUrl" :doc-url="docUrl"
        :status="status" :status-state="statusState" :authenticated="authenticated"
        :recharge-url="rechargeUrl" :custom-endpoints="customEndpoints" :sample-ms="sampleMs" @refresh="emit('refresh')" />

      <header class="signal-header">
        <a class="signal-brand" href="#origin" :aria-label="t('home.flight.restart')">
          <img :src="siteLogo || '/logo.svg'" alt="" width="40" height="25" />
          <span>{{ brandName }}</span>
        </a>
        <div class="signal-tools">
          <LocaleSwitcher />
          <nav class="signal-nav" :aria-label="t('home.signal.navigation')">
            <RouterLink v-if="modelPlaza" to="/model-plaza" class="home-model-plaza-nav">{{ t('nav.modelPlaza') }}</RouterLink>
            <i v-if="modelPlaza" aria-hidden="true"></i>
            <Button as-child variant="ghost" class="signal-login">
              <RouterLink :to="workspacePath">{{ authenticated ? t('home.dashboard') : t('home.login') }} <Icon name="arrowRight" size="sm" aria-hidden="true" /></RouterLink>
            </Button>
          </nav>
        </div>
      </header>

      <a href="#plaza" class="signal-scroll-cue signal-explore" :class="{ 'is-away': progress > .055 }"
        :inert="progress > .055 ? true : undefined" :aria-hidden="progress > .055">
        {{ t('home.signal.scroll') }} <i aria-hidden="true"></i>
      </a>

      <footer class="flight-hud">
        <div class="flight-location">
          <span aria-hidden="true">0{{ index + 1 }} <i>/</i> 04</span>
          <span>{{ t(flightStops[index].label) }}</span>
        </div>
        <nav class="flight-stops" :aria-label="t('home.flight.nav')">
          <a v-for="(stop, n) in flightStops" :key="stop.id" :href="'#' + stop.id"
            :aria-label="t(stop.label)" :aria-current="n === index ? 'step' : undefined" :title="t(stop.label)">
            <span class="stop-tick" aria-hidden="true"></span><span class="stop-text">{{ t(stop.label) }}</span>
          </a>
        </nav>
        <div class="signal-motion">
          <button v-if="!reduced" type="button" :aria-label="t('home.signal.motion')" :aria-pressed="!paused"
            :title="t(paused ? 'home.flight.resume' : 'home.flight.pause')" @click="paused = !paused; resetPointer()">
            <span class="signal-meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span>{{ t(paused ? 'home.signal.resume' : 'home.signal.pause') }}</span>
          </button>
          <span v-else>{{ t('home.signal.still') }}</span>
        </div>
      </footer>
      <div class="flight-progress" aria-hidden="true"><i :style="{ transform: `scaleX(${progress})` }"></i></div>
      <span class="sr-only">{{ tagline }}</span>
    </div>
  </main>
</template>

<style scoped>
.z30-home {
  position: relative; height: 730svh; isolation: isolate; color-scheme: dark; color: #edf5f3;
  background: #04090d; font-family: 'Geist Variable', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.flight-anchor { position: absolute; height: 1px; width: 1px; pointer-events: none; }
.signal {
  position: sticky; top: 0; height: 100svh; width: 100%; isolation: isolate; overflow: hidden;
  --silver: #e8f3f0; --subtle: #acbcbf; --mint: #b7edd5;
  --mono: 'Geist Mono Variable', ui-monospace, monospace;
  --gutter: clamp(20px,4.3vw,76px);
  background: #050a0f; color: var(--silver);
}
.signal-plate { position:absolute; inset:0; z-index:-2; width:100%; height:100%; object-fit:cover; object-position:50% 68%; pointer-events:none; }
.signal-core {
  position:absolute; z-index:2; top:50%; left:50%; width:clamp(188px,min(30vw,65svh),535px);
  pointer-events:none; transform:translate(-50%,-50%); transform-origin:50% 50%;
}
.signal-header, .flight-hud {
  position:absolute; z-index:10; left:var(--gutter); right:var(--gutter); display:flex; align-items:center;
  justify-content:space-between; pointer-events:none;
}
.signal-header { top:max(18px,env(safe-area-inset-top)); height:48px; gap:12px; }
.signal-header a,.signal-header button,.signal-tools,.flight-hud a,.flight-hud button { pointer-events:auto; }
.signal-brand,.signal-tools,.signal-nav,.signal-login,.signal-motion button { display:flex; align-items:center; }
.signal-brand { gap:10px; max-width:35%; min-width:0; font-size:14px; font-weight:600; letter-spacing:-.04em; text-shadow:0 1px 12px #030910; }
.signal-brand img { width:40px; height:26px; object-fit:contain; flex:none; }
.signal-brand span { white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
.signal-tools { gap:10px; }
.signal-tools :deep(.relative > button) { min-height:44px; color:var(--subtle); }
.signal-nav { min-height:42px; gap:13px; padding:0 16px; border:1px solid #80b2a84d; background:#061014bf; border-radius:999px; backdrop-filter:blur(12px); }
.signal-nav a { min-height:42px; font-size:12px; display:inline-flex; align-items:center; }
.signal-nav i { width:22px; height:1px; background:#9bb8b1; opacity:.55; }
.signal-nav .signal-login { color:var(--silver); padding:0; gap:8px; background:transparent; }
.signal-nav .signal-login:hover,.signal-nav a:hover { color:var(--mint); }
.signal-scroll-cue {
  position:absolute; z-index:3; left:50%; top:30%; transform:translateX(-50%);
  display:flex; flex-direction:column; align-items:center; gap:10px; padding:10px; min-height:44px;
  font:10px/1.4 var(--mono); letter-spacing:.16em; color:#c6d7d4; text-transform:uppercase;
}
.signal-scroll-cue i { width:1px; height:22px; background:linear-gradient(transparent,#9ccbc1); }
.signal-scroll-cue.is-away { visibility:hidden; }
.flight-hud { bottom:max(14px,env(safe-area-inset-bottom)); gap:14px; min-height:44px; }
.flight-location { min-width:90px; display:flex; align-items:center; gap:12px; }
.flight-location>span:first-child,.signal-motion { font:10px/1.35 var(--mono); letter-spacing:.06em; }
.flight-location i { opacity:.42; font-style:normal; }
.flight-location>span+span { font-size:12px; color:var(--subtle); }
.flight-stops { display:flex; position:absolute; left:50%; transform:translateX(-50%); gap:clamp(6px,1.4vw,24px); align-items:center; }
.flight-stops a { display:flex; align-items:center; justify-content:center; gap:6px; min-height:44px; padding:0 3px; color:var(--subtle); }
.stop-tick { height:1px; width:11px; background:currentColor; opacity:.7; }
.stop-text { font:10px/1.35 var(--mono); letter-spacing:.035em; }
.flight-stops a[aria-current] { color:white; }
.flight-stops a[aria-current] .stop-tick { height:2px; background:var(--mint); opacity:1; }
.signal-motion { color:var(--subtle); margin-left:auto; }
.signal-motion button { min-height:44px; gap:8px; }
.signal-meter { display:inline-flex; gap:2px; height:12px; align-items:center; }
.signal-meter i { height:5px; width:2px; background:var(--mint); }
.signal-meter i:nth-child(2) { height:12px; }
.signal-meter i:nth-child(3) { height:8px; }
.signal-motion button[aria-pressed=false] i { height:2px; }
.flight-progress { position:absolute; z-index:10; bottom:0; left:0; width:100%; height:1px; background:#c8ebe31a; pointer-events:none; }
.flight-progress i { display:block; height:100%; transform-origin:left center; background:#9acdc3; }
.signal :is(a,button):focus-visible { outline:2px solid var(--mint); outline-offset:3px; }
@media(max-width:780px) {
  .signal { --gutter:clamp(14px,4.5vw,24px); }
  .signal-header { top:max(10px,env(safe-area-inset-top)); height:44px; }
  .signal-brand { gap:6px; }
  .signal-brand img { width:33px; }
  .signal-tools { gap:4px; }
  .signal-nav { padding:0 12px; gap:6px; }
  .signal-nav .home-model-plaza-nav,.signal-nav i { display:none; }
  .signal-core { width:clamp(165px,53vw,330px); }
  .flight-stops { gap:0; }
  .flight-stops a { min-width:29px; }
  .stop-text,.flight-location>span+span,.signal-motion button>span+span { display:none; }
  .flight-location { min-width:0; }
  .signal-motion button { min-width:44px; justify-content:center; }
}
@media(max-height:500px) {
  .signal-header { top:3px; }
  .flight-hud { bottom:0; }
  .signal-scroll-cue { top:17%; }
}
@media(prefers-reduced-motion:reduce) {
  .z30-home { height:490svh; }
}
</style>
