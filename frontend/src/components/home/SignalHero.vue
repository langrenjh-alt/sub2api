<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { HomepageStatusResponse } from '@/api/homepageStatus'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { Button } from '@/components/ui/button'
import GlassWordmark from './GlassWordmark.vue'
import AtelierPlate from './AtelierPlate.vue'
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
const active = computed(() => !paused.value && !reduced.value && visible.value && inView.value)
const index = computed(() => currentFlightStop(progress.value))
const openerStyle=computed(()=>{
  const out=phase(.013,.095,progress.value)
  return { opacity:1-out, transform:reduced.value?undefined:`translate3d(0,${-out*22}px,0)` }
})
const orbit = computed(() => reduced.value ? 0 :
  phase(.005, .095, progress.value) * (1 - phase(.163, .286, progress.value)) +
  .22 * phase(.26, .34, progress.value))
const logoStyle = computed(() => {
  const p = progress.value
  if (reduced.value) return { opacity: p < .15 ? 1 : 0 }
  const opening = phase(.135,.268,p), lift = phase(.279,.36,p)
  const tilt = phase(.04,.13,p)
  return {
    opacity: 1-phase(.302,.358,p),
    transform: `translate(calc(-50% + ${opening*4}% + ${opening*2}vw), calc(-50% - ${lift*36}svh + ${tilt*(1-opening)*2}svh)) scale(${1-.16*tilt+.86*opening})`,
  }
})
const seamVisible = computed(() => !reduced.value && progress.value >= .125 && progress.value < .255)
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
  if(reduced.value || snapNext || document.hidden) {
    progress.value=target;velocity=0;pointerX.value=0;pointerY.value=0
  } else {
    const [p,v]=followFocus(progress.value,velocity,target,Math.max(0,Math.min(.15,dt)))
    progress.value=p;velocity=v
    const k=1-Math.exp(-Math.max(0,dt)*12)
    const easeAim=(current:number, aim:number)=>Math.abs(current-aim)<.0008 ? aim : current+(aim-current)*k
    pointerX.value=easeAim(pointerX.value,aimX);pointerY.value=easeAim(pointerY.value,aimY)
  }
  snapNext=false;last=now
  if(!reduced.value && !document.hidden &&
      (target!==progress.value || velocity!==0 || pointerX.value!==aimX || pointerY.value!==aimY)) schedule()
  else last=0
}
function schedule() {
  if(!queued && !document.hidden) queued=window.requestAnimationFrame(tick)
}
function queue() { dirtyLayout=true;schedule() }
function resync() { snapNext=true;queue() }
function resetPointer() { if(!paused.value){aimX=0;aimY=0;schedule()} }
function toggleMotion() {
  paused.value=!paused.value
  // Pause the light, not the exhibition: never jump to a different camera
  // position or swap the current folio for the reduced-motion layout.
  if(paused.value){aimX=pointerX.value;aimY=pointerY.value}
  else resetPointer()
}
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
      <AtelierPlate :progress="progress" :x="pointerX" :y="pointerY" :active="active" :reduced="reduced" />
      <JourneyWorld :progress="progress" :active="active" :reduced="reduced" :pointer-x="pointerX" :pointer-y="pointerY" @veil="onVeil" />

      <div class="signal-glass-layer" :aria-hidden="progress >= .358 ? true : undefined">
        <div class="signal-core" :style="logoStyle">
          <GlassWordmark ref="glass" :progress="progress" :travel="orbit" :active="active && progress < .358" :pointer-x="pointerX" :pointer-y="pointerY" />
        </div>
      </div>
      <OriginAtmosphere ref="air" :progress="progress" :active="active" :reduced="reduced" />
      <JourneyChapters :progress="progress" :reduced="reduced" :model-plaza="modelPlaza"
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
          <img :src="siteLogo || '/z30-mono.svg'" alt="" width="54" height="28" :class="{ 'edition-mark': !siteLogo }" />
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

      <div v-show="progress < .095" class="origin-caption" :style="openerStyle"
        :aria-hidden="progress>.08" :inert="progress>.08 ? true : undefined">
        <p class="edition-label"><span aria-hidden="true"></span> Z30 <i>/</i> MODEL SYSTEMS</p>
        <h2>{{ t('home.signal.headline') }}</h2>
        <p class="edition-deck">{{ !tagline || tagline === t('home.heroSubtitle') || tagline === 'Subscription to API Conversion Platform' ? t('home.signal.deck') : tagline }}</p>
      </div>

      <footer class="flight-hud">
        <div class="flight-location">
          <a href="#plaza" class="signal-explore" v-show="index===0"><span aria-hidden="true">↓</span>{{ t('home.signal.scroll') }}</a>
          <a href="#origin" class="edition-return" v-show="index!==0"><span aria-hidden="true">↑</span>{{ t('home.flight.restart') }}</a>
        </div>
        <nav class="flight-stops" :aria-label="t('home.flight.nav')">
          <a v-for="(stop, n) in flightStops" :key="stop.id" :href="'#' + stop.id"
            :aria-label="t(stop.label)" :aria-current="n === index ? 'step' : undefined" :title="t(stop.label)">
            <span class="stop-tick" aria-hidden="true"></span><span class="stop-no" aria-hidden="true">0{{n+1}}</span><span class="stop-text">{{ t(stop.label) }}</span>
          </a>
        </nav>
        <div class="signal-motion">
          <button v-if="!reduced" type="button" :aria-label="t('home.signal.motion')" :aria-pressed="!paused"
            :title="t(paused ? 'home.flight.resume' : 'home.flight.pause')" @click="toggleMotion">
            <span class="signal-meter" aria-hidden="true"><i></i><i></i></span>
          </button>
          <span v-else>{{ t('home.signal.still') }}</span>
        </div>
      </footer>
      <div class="flight-progress" aria-hidden="true"><i :style="{ transform: `scaleX(${progress})` }"></i></div>
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
  --silver: #f1f0ea; --subtle: #c8c6c0; --mint: #f0cda4;
  --mono: 'Geist Mono Variable', ui-monospace, monospace;
  --gutter: clamp(24px,4.2vw,76px);
  background: #050a0f; color: var(--silver);
}
.signal-glass-layer { position:absolute; z-index:3; inset:0; pointer-events:none; }
.signal-core {
  position:absolute; top:47.5%; left:50%; width:clamp(212px,min(36vw,75svh),650px);
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
.signal-brand {gap:14px;min-width:0;max-width:42%;text-shadow:0 1px 8px #000a;}
.signal-brand img {width:54px;height:28px;object-fit:contain;flex:none;}
.signal-brand img.edition-mark {filter:brightness(0) invert(.94);}
.signal-brand span {font-size:13px;font-weight:500;border-left:1px solid #ddd3bd66;padding-left:13px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;}
.signal-tools {gap:20px;}
.signal-tools :deep(.relative > button) {min-height:44px;color:var(--silver);background:transparent;border-radius:0;font:500 11px/1 var(--mono);letter-spacing:.04em;text-shadow:0 1px 8px #000;}
.signal-tools :deep(.relative > button > span:first-child){display:none;}
.signal-tools :deep(.relative > button > span:nth-child(2)){display:inline;}
.signal-nav {min-height:44px;gap:13px;padding:0 17px;border:1px solid #e9e3d864;background:#101011a6;border-radius:99px;backdrop-filter:blur(12px);}
.signal-nav a {min-height:44px;font-size:13px;display:inline-flex;align-items:center;}
.signal-nav i {width:22px;height:1px;background:#e8dccb;opacity:.55;}
.signal-nav .signal-login {color:var(--silver);padding:0;gap:10px;background:transparent;}
.signal-nav .signal-login:hover,.signal-nav a:hover {color:var(--mint);}
.origin-caption {position:absolute;z-index:5;left:var(--gutter);bottom:clamp(85px,14svh,154px);max-width:min(66vw,680px);pointer-events:none;color:#f4f2eb;text-shadow:0 2px 20px #08090ad4;}
.edition-label,.origin-caption h2,.edition-deck {margin:0;}
.edition-label {display:flex;align-items:center;gap:10px;font:500 10px/1.4 var(--mono);letter-spacing:.13em;color:#e6e0d8;}
.edition-label span {width:29px;height:1px;background:#ddb180;}
.edition-label i {font-style:normal;color:#ddbf9e;}
.origin-caption h2 {margin:15px 0 9px;font-size:clamp(37px,3.7vw,68px);line-height:1.05;font-weight:480;letter-spacing:-.045em;text-wrap:balance;}
.edition-deck {font-size:clamp(13px,1.02vw,17px);line-height:1.55;max-width:38ch;letter-spacing:.015em;color:#d9d9d2;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}
.flight-hud {bottom:max(14px,env(safe-area-inset-bottom));min-height:48px;gap:20px;border-top:1px solid #e7e1d02f;}
.flight-location,.signal-motion {display:flex;align-items:center;color:var(--subtle);}
.flight-location a {display:inline-flex;align-items:center;gap:11px;min-height:44px;font-size:12px;}
.flight-location a>span {font-size:16px;color:var(--silver);}
.flight-stops {display:flex;margin-left:auto;align-items:center;gap:clamp(10px,1.7vw,32px);}
.flight-stops a {display:flex;align-items:center;gap:7px;min-height:44px;color:#d1cec6;}
.stop-no {font:500 10px/1 var(--mono);letter-spacing:.02em;opacity:.7;}
.stop-text {font-size:11px;}
.stop-tick {height:1px;width:0;background:#f0cca0;transition:width .24s;}
.flight-stops a[aria-current]{color:white;}
.flight-stops a[aria-current] .stop-tick{width:17px;}
.signal-motion {border-left:1px solid #e7e1d042;padding-left:10px;font-size:11px;}
.signal-motion button{color:var(--silver);min-height:44px;min-width:38px;justify-content:center;}
.signal-meter {width:15px;height:15px;display:inline-flex;gap:3px;align-items:center;justify-content:center;}
.signal-meter i{height:9px;width:2px;background:currentColor;}
.signal-motion button[aria-pressed=false] .signal-meter::after {content:'';border-left:8px solid currentColor;border-block:5px solid transparent;}
.signal-motion button[aria-pressed=false] .signal-meter i{display:none;}
.flight-progress {position:absolute;z-index:10;bottom:0;left:0;width:100%;height:1px;pointer-events:none;}
.flight-progress i {display:block;height:100%;transform-origin:left center;background:#dfc9a2a3;}
.signal :is(a,button):focus-visible {outline:2px solid var(--mint);outline-offset:3px;}
@media(max-width:780px) {
  .signal {--gutter:clamp(20px,5.3vw,33px);}
  .signal-header {top:max(15px,env(safe-area-inset-top));height:44px;}
  .signal-brand {gap:8px;}.signal-brand img{width:41px;}.signal-brand span{padding-left:9px;font-size:12px;}
  .signal-tools {gap:4px;}.signal-nav{padding:0 13px;gap:6px;}
  .signal-nav .home-model-plaza-nav,.signal-nav i {display:none;}
  .signal-core{width:clamp(205px,62vw,360px);top:45%;}
  .origin-caption {max-width:85vw;bottom:max(100px,15svh);}
  .origin-caption h2 {font-size:clamp(34px,8vw,50px);margin:12px 0 8px;}
  .flight-hud {gap:7px;bottom:max(9px,env(safe-area-inset-bottom));}
  .flight-stops{gap:0;}.flight-stops a{min-width:34px;justify-content:center;gap:4px;}
  .flight-stops a[aria-current] .stop-tick{width:8px;}.stop-text{display:none;}
  .signal-motion{padding-left:4px;}.signal-motion button{min-width:34px;}
}
@media(max-width:355px){.flight-location a{gap:5px;font-size:11px;}.flight-stops a{min-width:29px;}.signal-brand span{max-width:62px;}}
@media(max-height:500px) {
  .signal-header{top:3px;}.flight-hud{bottom:0;}.origin-caption{bottom:59px;max-width:37vw;}
  .origin-caption h2{font-size:26px;margin:6px 0;}.edition-deck{font-size:12px;}
  .signal-core{top:44%;width:30vw;}
}
@media(prefers-reduced-motion:reduce) {
  .z30-home { height:490svh; }
}
</style>
