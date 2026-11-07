<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { HomepageStatusResponse } from '@/api/homepageStatus'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { Button } from '@/components/ui/button'
import GlassWordmark from './GlassWordmark.vue'
import OriginAtmosphere from './OriginAtmosphere.vue'
import JourneyWorld from './JourneyWorld.vue'
import JourneyChapters from './JourneyChapters.vue'
import { clamp01, currentFlightStop, flightProgress, flightStops, followFocus, phase } from './journey/path'

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
const glass = ref<InstanceType<typeof GlassWordmark>>()
const air = ref<InstanceType<typeof OriginAtmosphere>>()
const veilCanvas = ref<HTMLCanvasElement>()
const veilReady = ref(false)
let snapAspect = 0
const pointerX = ref(0), pointerY = ref(0)
const paused = ref(false), reduced = ref(false), visible = ref(true), inView = ref(true)
const still = computed(() => paused.value || reduced.value)
const active = computed(() => !still.value && visible.value && inView.value)
const index = computed(() => currentFlightStop(progress.value))
const orbit = computed(() => still.value ? 0 :
  phase(.005, .095, progress.value) * (1 - phase(.163, .286, progress.value)) +
  .22 * phase(.26, .34, progress.value))
const logoStyle = computed(() => {
  const p = progress.value
  if (still.value) return { opacity: p < .15 ? 1 : 0 }
  const opening = phase(.135,.268,p), lift = phase(.279,.36,p)
  const tilt = phase(.04,.13,p)
  return {
    opacity: 1-phase(.302,.358,p),
    transform: `translate(calc(-50% + ${opening*4}% + ${opening*2}vw), calc(-50% - ${lift*36}svh + ${tilt*(1-opening)*2}svh)) scale(${1-.16*tilt+.86*opening})`,
  }
})
const seamVisible = computed(() => !still.value && progress.value >= .125 && progress.value < .255)
const veilStyle = computed(() => {
  const p=progress.value,cut=phase(.155,.25,p)
  const left=114-124*cut,right=105-131*cut
  // A polished but imperfect edge: the highlight breaks in small sections,
  // never a straight full-width comparison slider across the photograph.
  const edge = Array.from({length:33}, (_, i) => {
    const x=i/32
    const grain=(Math.sin(x*37+p*15)*.18+Math.sin(x*77-p*28)*.11)*Math.sin(Math.PI*x)
    return {x:x*100,y:left+(right-left)*x+grain}
  })
  const line=(offset:number,backward=false)=>(backward?[...edge].reverse():edge)
    .map(v=>`${v.x}% ${(v.y+offset).toFixed(3)}%`).join(',')
  return {
    opacity:phase(.125,.15,p), '--lift':cut,
    '--seam-shape':`polygon(0 0,100% 0,${line(0,true)})`,
    '--seam-glint':`polygon(${line(-.21)},${line(0,true)})`,
  }
})
function onVeil(source: HTMLCanvasElement) {
  const out=veilCanvas.value, el=stage.value
  if (!out || !el || !source.width || !source.height) return
  const ctx=out.getContext('2d'); if (!ctx) return
  out.width=source.width; out.height=source.height
  ctx.drawImage(source,0,0)
  // Bake the small, outgoing mark WITH the world. The live, larger letters
  // are then revealed underneath it. No per-frame GPU readback is required.
  const mark=glass.value?.capture()
  if(mark) {
    const b=mark.getBoundingClientRect(), v=el.getBoundingClientRect()
    if(v.width && v.height) ctx.drawImage(mark,(b.left-v.left)*out.width/v.width,
      (b.top-v.top)*out.height/v.height,b.width*out.width/v.width,b.height*out.height/v.height)
  }
  glass.value?.field(source)
  snapAspect=source.width/source.height;veilReady.value=true
}
const anchors = [
  ...flightStops,
  { id: 'actions', point: 0.445 }, { id: 'compatibility', point: 0.445 },
  { id: 'capabilities', point: 0.23 }, { id: 'access', point: 0.66 },
  { id: 'status', point: 0.94 },
]
let queued = 0, last = 0, target = 0, velocity = 0, aimX = 0, aimY = 0
let dirtyLayout = true, snapNext = true
let mq: MediaQueryList | undefined
let io: IntersectionObserver | undefined
let ro: ResizeObserver | undefined

// Native scroll selects an optical destination. All layers share the *same*
// filtered position; pointer, autonomous light and scroll remain distinct.
function tick(now: number) {
  queued = 0
  const el=runway.value, view=stage.value
  if (!el || !view) return
  const dt = last ? (now-last)/1000 : 1/60
  if(dirtyLayout){
    dirtyLayout=false
    const rect=el.getBoundingClientRect()
    target=flightProgress(rect.top,rect.height,view.offsetHeight)
    if(snapAspect && Math.abs(view.clientWidth/Math.max(1,view.offsetHeight)-snapAspect)>.18) veilReady.value=false
  }
  if(still.value || snapNext || document.hidden) {
    progress.value=target;velocity=0;pointerX.value=0;pointerY.value=0
  } else {
    const [p,v]=followFocus(progress.value,velocity,target,Math.max(0,Math.min(.15,dt)))
    progress.value=p;velocity=v
    const k=1-Math.exp(-Math.max(0,dt)*12)
    const easeAim=(current:number, aim:number)=>Math.abs(current-aim)<.0008 ? aim : current+(aim-current)*k
    pointerX.value=easeAim(pointerX.value,aimX);pointerY.value=easeAim(pointerY.value,aimY)
  }
  snapNext=false;last=now
  if(!still.value && !document.hidden &&
      (target!==progress.value || velocity!==0 || pointerX.value!==aimX || pointerY.value!==aimY)) schedule()
  else last=0
}
function schedule() {
  if(!queued && !document.hidden) queued=window.requestAnimationFrame(tick)
}
function queue() { dirtyLayout=true;schedule() }
function resync() { snapNext=true;queue() }
function resetPointer() { aimX=0;aimY=0;schedule() }
function sync() {
  reduced.value = mq?.matches ?? false; visible.value = !document.hidden
  if(reduced.value || !visible.value) resetPointer()
  if(!visible.value){if(queued)cancelAnimationFrame(queued);queued=0;last=0}
  else resync()
}
function point(e: PointerEvent) {
  if (!active.value || e.pointerType === 'touch' || !stage.value) return
  const b = stage.value.getBoundingClientRect()
  aimX = 2 * clamp01((e.clientX-b.left)/Math.max(1,b.width)) - 1
  aimY = 2 * clamp01((e.clientY-b.top)/Math.max(1,b.height)) - 1
  air.value?.disturb(aimX,aimY,performance.now());schedule()
}
onMounted(() => {
  mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  sync()
  mq.addEventListener?.('change', sync)
  document.addEventListener('visibilitychange', sync)
  window.addEventListener('scroll', queue, { passive: true })
  window.addEventListener('resize', resync)
  window.addEventListener('pageshow', resync)
  window.addEventListener('hashchange', resync)
  if ('ResizeObserver' in window && runway.value && stage.value) {
    ro = new ResizeObserver(resync); ro.observe(runway.value); ro.observe(stage.value)
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
  window.removeEventListener('resize', resync)
  window.removeEventListener('pageshow', resync)
  window.removeEventListener('hashchange', resync)
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
      <JourneyWorld :progress="progress" :active="active" :reduced="still" :pointer-x="pointerX" :pointer-y="pointerY" @veil="onVeil" />

      <div class="signal-glass-layer" :aria-hidden="progress >= .358 ? true : undefined">
        <div class="signal-core" :style="logoStyle">
          <GlassWordmark ref="glass" :progress="progress" :travel="orbit" :active="active && progress < .358" :pointer-x="pointerX" :pointer-y="pointerY" />
        </div>
      </div>
      <OriginAtmosphere ref="air" :progress="progress" :active="active" :reduced="still" />
      <JourneyChapters :progress="progress" :reduced="still" :model-plaza="modelPlaza"
        :workspace-path="workspacePath" :base-url="baseUrl" :doc-url="docUrl"
        :status="status" :status-state="statusState" :authenticated="authenticated"
        :recharge-url="rechargeUrl" :custom-endpoints="customEndpoints" :sample-ms="sampleMs" @refresh="emit('refresh')" />

      <!-- A photographic cut along a real frame of the outgoing field, not a black interstitial. -->
      <div v-show="seamVisible" class="signal-veil" aria-hidden="true" :style="veilStyle">
        <div class="veil-surface">
          <picture v-if="seamVisible && !veilReady">
            <source media="(max-aspect-ratio: 3/4)" srcset="/assets/home/journey/estuary-mobile.webp" />
            <img src="/assets/home/journey/estuary-wide.webp" alt="" />
          </picture>
          <canvas ref="veilCanvas" :class="{ 'veil-ready': veilReady }"></canvas>
          <i class="veil-caustic"></i>
        </div>
        <i class="veil-lip"></i>
      </div>

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
.signal-glass-layer { position:absolute; z-index:3; inset:0; pointer-events:none; }
.signal-core {
  position:absolute; top:50%; left:50%; width:clamp(188px,min(30vw,65svh),535px);
  pointer-events:none; transform:translate(-50%,-50%); transform-origin:50% 50%;
}
.signal-veil {
  position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden;
  clip-path:var(--seam-shape);
}
.veil-surface {position:absolute;inset:-1%;transform:perspective(1500px) translateY(calc(var(--lift)*-7%)) rotateX(calc(var(--lift)*4deg)) rotateZ(calc(var(--lift)*-.65deg)) scale(1.11);transform-origin:50% 30%;}
.veil-surface picture,.veil-surface img,.veil-surface canvas {position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
.veil-surface canvas:not(.veil-ready){visibility:hidden}
.veil-caustic {position:absolute;inset:-20%;opacity:.22;background:linear-gradient(117deg,transparent 43%,#80e8b51a 49%,#b2e7f836 50%,transparent 54%);
  animation:veil-drift 3.8s ease-in-out infinite alternate;}
@keyframes veil-drift {from{transform:translateX(-8%)}to{transform:translateX(9%)}}
.veil-lip {position:absolute;inset:0;clip-path:var(--seam-glint);opacity:.78;
  background:linear-gradient(95deg,transparent 2%,#95c5ce90 13%,transparent 20%,transparent 33%,#c0eaf5b3 42%,transparent 51%,#c5dcca7d 66%,transparent 79%);}

.signal[data-motion=off] .veil-caustic{animation-play-state:paused}
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
