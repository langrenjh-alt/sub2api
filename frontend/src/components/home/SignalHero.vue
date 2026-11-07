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
import JourneyWorld from './JourneyWorld.vue'
import JourneyChapters from './JourneyChapters.vue'
import { clamp01, currentFlightStop, irisReadingPose, flightProgress, flightStops, followFocus, phase } from './journey/path'

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
const rendererMode=ref<'pending'|'webgl'|'still'>('pending')
const pointerX = ref(0), pointerY = ref(0)
const paused = ref(false), reduced = ref(false), visible = ref(true), inView = ref(true)
const active = computed(() => !paused.value && !reduced.value && visible.value && inView.value)
const index = computed(() => currentFlightStop(progress.value))
const openerStyle=computed(()=>{
  const out=phase(.013,.095,progress.value)
  return { opacity:1-out, transform:reduced.value?undefined:`translate3d(0,${-out*22}px,0)` }
})
const anchors = [
  ...flightStops,
  { id: 'actions', point: 0.445 }, { id: 'compatibility', point: 0.445 },
  { id: 'capabilities', point: 0.23 }, { id: 'access', point: 0.66 },
  { id: 'status', point: irisReadingPose },
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
  schedule()
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
      <AtelierPlate v-if="rendererMode==='still' && progress<.12" :progress="progress" />
      <JourneyWorld :progress="progress" :active="active" :reduced="reduced" :pointer-x="pointerX" :pointer-y="pointerY" @mode="rendererMode=$event" />
      <GlassWordmark :mode="rendererMode" :progress="progress" />
      <JourneyChapters :progress="progress" :reduced="reduced" :model-plaza="modelPlaza"
        :workspace-path="workspacePath" :base-url="baseUrl" :doc-url="docUrl"
        :status="status" :status-state="statusState" :authenticated="authenticated"
        :recharge-url="rechargeUrl" :custom-endpoints="customEndpoints" :sample-ms="sampleMs" @refresh="emit('refresh')" />

      <header class="signal-header">
        <a class="signal-brand" href="#origin" :aria-label="t('home.flight.restart')">
          <img :src="siteLogo || '/z30-mono.svg'" alt="" width="54" height="28" :class="{ 'edition-mark': !siteLogo }" />
          <span>{{ brandName }}</span>
        </a>
        <div class="signal-tools">
          <button v-if="!reduced" class="motion-on-focus" type="button"
            :aria-label="t('home.signal.motion')" :aria-pressed="!paused" @click="toggleMotion">
            {{ t(paused ? 'home.flight.resume' : 'home.flight.pause') }}
          </button>
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
.signal-header {
  position:absolute; z-index:10; left:var(--gutter); right:var(--gutter); display:flex; align-items:center;
  justify-content:space-between; pointer-events:none;
}
.signal-header { top:max(18px,env(safe-area-inset-top)); height:48px; gap:12px; }
.signal-header a,.signal-header button,.signal-tools { pointer-events:auto; }
.signal-brand,.signal-tools,.signal-nav,.signal-login { display:flex; align-items:center; }
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
/* No persistent navigation/transport bar. A keyboard visitor can still pause
   the ambient scene without adding chrome to the composition. */
.motion-on-focus:not(:focus-visible) {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;pointer-events:none;}
.motion-on-focus:focus-visible {background:#101011;color:var(--silver);padding:0 12px;min-height:44px;border-radius:4px;}
.signal :is(a,button):focus-visible {outline:2px solid var(--mint);outline-offset:3px;}
@media(max-width:780px) {
  .signal {--gutter:clamp(20px,5.3vw,33px);}
  .signal-header {top:max(15px,env(safe-area-inset-top));height:44px;}
  .signal-brand {gap:8px;}.signal-brand img{width:41px;}.signal-brand span{padding-left:9px;font-size:12px;}
  .signal-tools {gap:4px;}.signal-nav{padding:0 13px;gap:6px;}
  .signal-nav .home-model-plaza-nav,.signal-nav i {display:none;}
  .origin-caption {max-width:85vw;bottom:max(100px,15svh);}
  .origin-caption h2 {font-size:clamp(34px,8vw,50px);margin:12px 0 8px;}

}
@media(max-width:355px){.signal-brand span{max-width:62px;}}
@media(max-height:500px) {
  .signal-header{top:3px;}.origin-caption{bottom:59px;max-width:37vw;}
  .origin-caption h2{font-size:26px;margin:6px 0;}.edition-deck{font-size:12px;}
}
@media(prefers-reduced-motion:reduce) {
  .z30-home { height:490svh; }
}
</style>
