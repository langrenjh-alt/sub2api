<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { Button } from '@/components/ui/button'
import { blend, galleryAngle, galleryWorks, panelWindow } from './journey/galleryPath'
import { useClipboard } from '@/composables/useClipboard'
import { formatMultiplier } from '@/utils/formatters'
import type { HomepageStatusResponse } from '@/api/homepageStatus'

const props = defineProps<{
  progress: number
  reduced: boolean
  modelPlaza: boolean
  workspacePath: string
  baseUrl: string
  docUrl: string
  status: HomepageStatusResponse | null
  statusState: 'loading' | 'ready' | 'error'
  authenticated: boolean
  rechargeUrl: string
  sampleMs?: number | null
  customEndpoints?: Array<{ name: string; endpoint: string; description?: string }>
}>()

const emit = defineEmits<{ refresh: [] }>()
const { t } = useI18n()
const { copyToClipboard, copied } = useClipboard()
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n))
const ease = (n: number) => { const c = clamp(n); return c * c * (3 - 2 * c) }
const chapters = [[.15,.32], [.32,.55], [.55,.78], [.78,1]] as const
const chapter = computed(() => props.progress < .15 ? -1 : props.progress < .32 ? 0 : props.progress < .55 ? 1 : props.progress < .78 ? 2 : 3)
const phase = (i: number) => (props.progress - chapters[i][0]) / (chapters[i][1] - chapters[i][0])
const editorialWindows = [[.147,.182,.286,.348], [.315,.352,.50,.544], [.551,.600,.748,.789], [.774,.828,1.03,1.08]] as const
function layer(i: number) {
  if (props.reduced) return { visibility: chapter.value === i ? 'visible' as const : 'hidden' as const, opacity: chapter.value === i ? 1 : 0 }
  const [start,,end,stop]=editorialWindows[i]
  const opacity=blend(start,start+.017,props.progress)*(1-blend(end+.018,stop,props.progress))
  return { visibility: opacity <= 0 ? 'hidden' as const : 'visible' as const, opacity }
}
function lift(i: number) {
  if (props.reduced) return undefined
  const [from,full,end,to]=editorialWindows[i], p=props.progress
  const enter=1-blend(from,full,p), depart=blend(end,to,p)
  // Different depths on the two sides of each handoff: the departing caption
  // rides upward, the instrument readout arrives below its optical edge.
  const x=i===0?-depart*4 : i===1?-depart*2.6 : enter*.6
  const y=i===1?enter*4-depart*5 : enter*12-depart*(i===3?0:i===2?26:14)
  const cut=enter*103
  return {
    transform: `translate3d(${x}vw,${y}vh,0)`,
    clipPath: `polygon(0 0, 100% 0, 100% ${102-cut}%, 0 ${102-cut*.83}%)`,
  }
}
function lineStyle(index: number) {
  if (props.reduced) return undefined
  const enter = ease((phase(0)*1.8 - index*.11)/.50)
  return { opacity: enter, transform: `translate3d(${(1-enter)*-22}px,${(1-enter)*36}px,0) rotateX(${(1-enter)*35}deg)` }
}

const fallbackPresence = computed(() => {
  const p=props.progress
  if(props.reduced)return chapter.value===1 ? 1 : 0
  return blend(.262,.31,p)*(1-blend(.626,.674,p))
})
function specimenStyle(index: number) {
  const p=props.progress
  if (props.reduced) {
    const current=Math.min(3,Math.max(0,Math.floor((p-.32)/.063)))
    return { opacity:index===current?1:0, zIndex:20-index, '--plane-x':'0vw', '--image-coverage':'.48' }
  }
  const a=galleryAngle(p,index)-.18, near=Math.cos(a), side=Math.sin(a)
  const transfer=index===3?blend(.525,.596,p):0
  const grab=index===0 ? 1-blend(.319,.373,p) : 0
  const ringX=side*33*(1-transfer) + (.22-blend(.554,.657,p))*52*transfer
  const ringY=(Math.sin(index*1.8)*3 + (1-blend(.276,.358,p))*29)*(1-transfer) - blend(.55,.665,p)*56*transfer
  const x=ringX*(1-grab)-5*grab
  const y=ringY*(1-grab)+(71-67*blend(.261,.313,p)-17*blend(.314,.34,p))*grab
  const visible=panelWindow(p,index) + transfer*(1-blend(.602,.674,p))*.32
  return {
    opacity:clamp(visible), zIndex:10+Math.round((near+1)*10),
    '--plane-x':`${x}vw`, '--plane-y':`${y}vh`, '--plane-z':`${(near-.34)*160*(1-transfer)*(1-grab)}px`,
    '--plane-yaw':`${(a*180/Math.PI)*(1-transfer)*(1-grab) + 10*grab - transfer*38}deg`,
    '--plane-roll':`${-side*3.1+transfer*4}deg`,
    '--image-coverage': String(.29+.23*(1-near)/2),
  }
}
const endpointIndex = ref(0)
const endpoints = computed(() => [
  { name: 'Base URL', endpoint: props.baseUrl },
  ...(props.customEndpoints ?? []).filter(e => e.endpoint.trim().length > 0),
])
const endpoint = computed(() => endpoints.value[endpointIndex.value] ?? endpoints.value[0])
const keysPath = computed(() => props.authenticated ? '/keys' : '/login?redirect=%2Fkeys')
watch(() => endpoints.value.length, count => { if (endpointIndex.value >= count) endpointIndex.value = 0 })

function monitorLabel(status: string) {
  const s = status.trim().toLowerCase()
  return t(`monitorCommon.status.${['operational','degraded','failed','error'].includes(s) ? s : 'unknown'}`)
}
function uptime(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${Number(clamp(value,0,100).toFixed(2))}%`
}
const records = computed(() => {
  if (props.statusState !== 'ready' || !props.status?.enabled) return []
  return [
    ...props.status.groups.map(g => ({
      id:`group-${g.id}`, name:g.name, label:t('home.journey.group'), detail:g.platform,
      value:Number.isFinite(g.rate_multiplier) ? `${formatMultiplier(g.rate_multiplier)}x` : '—', state:'rate',
    })),
    ...props.status.monitors.map(m => ({
      id:`monitor-${m.id}`, name:m.name, label:t('home.journey.monitor'),
      detail:`${m.provider} · ${monitorLabel(m.status)}`,
      value:`${uptime(m.uptime_7d)} / 7d`, state:m.status.trim().toLowerCase(),
    })),
  ]
})
const page = ref(0)
const shortScreen = ref(false)
let shortMedia: MediaQueryList | undefined
function syncShort() { shortScreen.value = shortMedia?.matches ?? false }
onMounted(() => {
  shortMedia = window.matchMedia?.('(max-height: 580px)')
  syncShort()
  shortMedia?.addEventListener?.('change', syncShort)
})
onBeforeUnmount(() => shortMedia?.removeEventListener?.('change', syncShort))
const perPage = computed(() => shortScreen.value ? 1 : 3)
const measuredMs = computed(() => props.statusState === 'ready' && typeof props.sampleMs === 'number'
  && Number.isFinite(props.sampleMs) && props.sampleMs >= 0 ? Math.round(props.sampleMs) : null)
const pages = computed(() => Math.max(1, Math.ceil(records.value.length/perPage.value)))
watch(pages, n => { page.value = Math.min(page.value,n-1) })
const readings = computed(() => records.value.slice(page.value*perPage.value, (page.value+1)*perPage.value))
const feedMessage = computed(() => t(`home.journey.${props.statusState === 'loading' ? 'busy' : props.statusState === 'error' ? 'unavailable' : props.status?.enabled ? 'empty' : 'private'}`))
</script>

<template>
  <div class="journey-chapters" :class="{ 'is-reduced': reduced }">
      <div class="archive-depth" aria-hidden="true" :style="{ visibility: fallbackPresence ? 'visible' : 'hidden', opacity: fallbackPresence }">
        <figure v-for="(specimen,index) in galleryWorks" :key="specimen.name" class="art-plane"
          :style="specimenStyle(index)">
          <img :src="`/assets/home/z30-archive-${specimen.image}.webp`" width="688" height="484" alt="" />
          <figcaption>
            <span class="art-index">A—{{ specimen.number }}</span>
            <strong>{{ specimen.name }}</strong>
            <small>{{ specimen.code }}</small>
          </figcaption>
        </figure>
      </div>
    <section class="j-scene manifest" data-journey="manifesto" :style="layer(0)"
      :inert="chapter !== 0 ? true : undefined" :aria-hidden="chapter !== 0" aria-labelledby="j-manifest">
      <div class="manifest-copy" :style="lift(0)">
        <p class="folio"><i></i>01 / TRANSMISSION</p>
        <h2 id="j-manifest">
          <span><b :style="lineStyle(0)">{{ t('home.journey.manifestoA') }}</b></span>
          <span><b :style="lineStyle(1)">{{ t('home.journey.manifestoB') }}</b></span>
        </h2>
        <p class="j-caption">{{ t('home.journey.manifestoText') }}</p>
      </div>
    </section>

    <section class="j-scene archive" data-journey="gallery" :style="layer(1)"
      :inert="chapter !== 1 ? true : undefined" :aria-hidden="chapter !== 1" aria-labelledby="j-archive">
      <div class="archive-copy" :style="lift(1)">
        <p class="folio"><i></i>02 / MODEL ATLAS</p>
        <h2 id="j-archive">{{ t('home.journey.galleryTitle') }}</h2>
        <p class="j-caption">{{ t('home.journey.galleryNote') }}</p>
        <Button v-if="modelPlaza" as-child variant="outline" class="j-link j-outline">
          <RouterLink to="/model-plaza" class="home-model-plaza-cta">
            {{ t('home.journey.browse') }} <Icon name="arrowRight" size="sm" aria-hidden="true" />
          </RouterLink>
        </Button>
      </div>
    </section>

    <section class="j-scene connection" data-journey="access" :style="layer(2)"
      :inert="chapter !== 2 ? true : undefined" :aria-hidden="chapter !== 2" aria-labelledby="j-connect">
      <div class="console-body" :style="lift(2)">
        <p class="folio"><i></i>03 / CONNECTION</p>
        <h2 id="j-connect">{{ t('home.journey.accessTitle') }}</h2>
        <p class="j-caption">{{ t('home.journey.accessText') }}</p>
        <div class="command">
          <div class="endpoint-label">
            <label v-if="endpoints.length > 1">
              <span class="sr-only">{{ t('home.journey.endpoint') }}</span>
              <select v-model="endpointIndex">
                <option v-for="(ep,n) in endpoints" :key="n" :value="n">{{ ep.name }}</option>
              </select>
            </label>
            <span v-else>BASE URL</span>
            <span class="command-line" aria-hidden="true"></span>
          </div>
          <div class="endpoint-line">
            <code>{{ endpoint.endpoint }}</code>
            <button type="button" :aria-label="t('home.journey.copyEndpoint')" @click="copyToClipboard(endpoint.endpoint)">
              {{ copied ? t('common.copied') : t('common.copy') }}
            </button>
          </div>
          <p class="command-path"><b>POST</b> /chat/completions</p>
        </div>
        <div class="console-links">
          <RouterLink :to="keysPath">{{ t('home.journey.keys') }} <span>↗</span></RouterLink>
          <RouterLink to="/key-usage">{{ t('home.journey.usage') }} <span>↗</span></RouterLink>
          <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }} <span>↗</span></a>
          <a v-if="rechargeUrl" :href="rechargeUrl" target="_blank" rel="noopener noreferrer">{{ t('home.landing.nav.recharge') }} <span>↗</span></a>
        </div>
      </div>
    </section>

    <section class="j-scene observatory" data-journey="observatory" :style="layer(3)"
      :inert="chapter !== 3 ? true : undefined" :aria-hidden="chapter !== 3" aria-labelledby="j-observe">
      <div class="observatory-body" :style="lift(3)">
        <p class="folio"><i></i>04 / TELEMETRY</p>
        <h2 id="j-observe">{{ t('home.journey.finalTitle') }}</h2>
        <p class="j-caption">{{ t('home.journey.statusIntro') }}</p>
        <div class="readout" :data-testid="records.length ? 'homepage-status-section' : undefined">
          <div class="feed-sample">
            <div v-if="measuredMs !== null" class="sample-value">
              <span>{{ t('home.journey.roundTrip') }}</span><strong>{{ measuredMs }} <small>ms</small></strong>
            </div>
            <button type="button" :disabled="statusState === 'loading'" @click="emit('refresh')">
              <Icon name="refresh" size="sm" aria-hidden="true" /> {{ t('home.journey.refresh') }}
            </button>
          </div>
          <div class="readout-scale" aria-hidden="true"></div>
          <template v-if="records.length">
            <div v-for="row in readings" :key="row.id" :data-testid="`homepage-status-${row.id}`"
              class="reading" :data-state="row.state">
              <div><span class="read-name">{{ row.name }}</span><small>{{ row.label }} · {{ row.detail }}</small></div>
              <strong>{{ row.value }}</strong>
            </div>
            <nav v-if="pages > 1" class="read-pages" :aria-label="t('home.journey.finalTitle')">
              <button type="button" :disabled="page === 0" :aria-label="t('home.journey.previous')" @click="page--">←</button>
              <span>{{ t('home.journey.page',{page:page+1,total:pages}) }}</span>
              <button type="button" :disabled="page === pages-1" :aria-label="t('home.journey.next')" @click="page++">→</button>
            </nav>
          </template>
          <p v-else class="no-readings" role="status">{{ feedMessage }}</p>
        </div>
        <Button variant="outline" as-child class="j-link j-outline j-enter">
          <RouterLink :to="workspacePath">{{ authenticated ? t('home.journey.enter') : t('home.journey.signIn') }}
            <Icon name="arrowRight" size="sm" aria-hidden="true" />
          </RouterLink>
        </Button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.journey-chapters {
  --j-ink:#f4f6f1; --j-faint:#c5d0d2; --j-line:rgba(186,219,226,.38); --j-signal:#b9f2d0;
  --j-mono:'Geist Mono Variable',ui-monospace,monospace;
  position:absolute; z-index:auto; inset:0; pointer-events:none;
  color:var(--j-ink); font-family:'Geist Variable','PingFang SC','Microsoft YaHei',sans-serif;
}
.j-scene { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
.j-scene[inert] :is(a,button,select) { pointer-events:none; }
.j-scene:not([inert]) :is(a,button,select) { pointer-events:auto; }
.j-scene :is(a,button,select):focus-visible { outline:2px solid var(--j-signal); outline-offset:3px; }
.j-scene p, .j-scene h2, .j-scene figure { margin:0; }
.folio, .art-index, .art-plane small, .endpoint-label, .command-path, .reading small, .read-pages {
  font:500 10px/1.35 var(--j-mono); letter-spacing:.12em; text-transform:uppercase;
}
.folio { color:var(--j-faint); display:flex; align-items:center; gap:10px; }
.folio i { height:1px; width:32px; background:linear-gradient(90deg,var(--j-signal),transparent); }
.j-scene h2 { font-weight:480; letter-spacing:-.055em; line-height:1.05; text-wrap:balance; }
.j-caption { color:var(--j-faint); font-size:clamp(13px,1.12vw,17px); line-height:1.55; max-width:44ch; }
.manifest-copy, .archive-copy, .console-body, .observatory-body {
  position:absolute; left:clamp(25px,8vw,154px); text-shadow:0 2px 23px rgba(0,0,0,.68);
}
.manifest-copy { top:34%; width:min(67vw,920px); }
.manifest-copy h2 { margin:17px 0 20px; font-size:clamp(52px,min(7.1vw,12vh),124px); line-height:.99; }
.manifest-copy h2 span { display:block; overflow:hidden; padding-bottom:.055em; }
.manifest-copy h2 b { display:block; font-weight:inherit; transform-origin:0 90%; }
.manifest-copy h2 span:last-child { color:#d5e8df; }
.manifest-copy .j-caption { max-width:41ch; }
.archive-depth {
  position:absolute; inset:0; z-index:4; perspective:850px; perspective-origin:64% 46%; transform-style:preserve-3d;
  pointer-events:none; overflow:clip;
}
.art-plane {
  position:absolute; left:60%; top:42%; width:clamp(230px,38vw,560px); aspect-ratio:1.53;
  transform:translate(-50%,-50%) translate3d(var(--plane-x),var(--plane-y),var(--plane-z)) rotateY(var(--plane-yaw)) rotateZ(var(--plane-roll));
  border:1px solid rgba(187,222,232,.46); border-radius:14px; overflow:hidden;
  box-shadow:1px 0 #b5d0d185,3px 2px #222c3d70,8px 12px 55px #03090b55;
  background:linear-gradient(148deg,rgba(159,207,222,.13),rgba(4,15,23,.08) 47%,rgba(86,107,149,.22));
  backdrop-filter:blur(1.6px) saturate(1.45) contrast(1.18);
}
.art-plane img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:var(--image-coverage,.42);
  animation:archive-flow 13s ease-in-out alternate infinite; }
.art-plane:nth-child(even) img { animation-direction:alternate-reverse; animation-duration:17s; }
@keyframes archive-flow { from { transform:scale(1.025) translate(-1%,.5%); } to { transform:scale(1.12) translate(1.5%,-1.6%); } }
.art-plane::after { content:''; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(127deg,transparent 21%,#b4dfe614 37%,transparent 45%,#72aaa510 82%,transparent); }
.art-plane figcaption { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:5%; text-shadow:0 2px 13px #030708; }
.art-index { position:absolute; top:8%; left:5%; color:#e4e9e4; }
.art-plane strong { order:2; font-size:clamp(28px,3.8vw,58px); line-height:1; letter-spacing:-.056em; font-weight:480; }
.art-plane small { order:1; margin-bottom:6px; font-size:10px; }
.manifest { z-index:2; }
.archive { z-index:5; }
.connection,.observatory {z-index:3}
.j-scene[inert] .j-link,.j-scene[inert] .console-links,.j-scene[inert] .feed-sample button { visibility:hidden; }
.is-reduced .art-plane img { animation:none; }
.archive-copy { left:clamp(25px,6vw,120px); bottom:18%; max-width:min(29vw,400px); }
.archive-copy h2, .console-body h2, .observatory-body h2 { margin:13px 0 12px; font-size:clamp(34px,min(4.4vw,8.2vh),84px); }
.archive-copy::before, .console-body::before, .observatory-body::before {
  content:''; z-index:-1; position:absolute; inset:-30% -19%; pointer-events:none;
  background:radial-gradient(ellipse at 32% 55%,rgba(3,9,13,.86) 0%,rgba(3,9,13,.56) 36%,transparent 75%);
}
.j-outline { margin-top:15px; min-height:44px; padding:0 16px; border:1px solid #bcdee975; border-radius:50px;
  color:var(--j-ink); background:rgba(4,15,21,.77); font-weight:500; box-shadow:none; }
.j-outline:hover { color:#07120e; background:#c9edda; }
.console-body, .observatory-body { top:50%; translate:0 -50%; width:min(49vw,680px); }
.console-body { left:clamp(25px,7vw,130px); }
.command { margin-top:23px; }
.endpoint-label { display:flex; align-items:center; gap:12px; color:#c6dce0; }
.endpoint-label select {
  min-height:32px; max-width:100%; cursor:pointer; color:#f3f5f0; background:#132029; border:1px solid var(--j-line);
  border-radius:3px; padding:0 6px; font:500 12px/1.4 var(--j-mono); letter-spacing:0;
}
.endpoint-label label { max-width:70%; }
.command-line { flex:1; height:1px; background:linear-gradient(90deg,#91b4c180,transparent); }
.endpoint-line { display:flex; gap:10px; align-items:center; border-bottom:1px solid var(--j-line); }
.endpoint-line code { overflow:auto; white-space:nowrap; flex:1; min-width:0; padding:10px 0; font:500 clamp(14px,1.55vw,24px)/1.4 var(--j-mono); }
.endpoint-line button, .console-links a { color:#e1f3f0; font-size:13px; }
.endpoint-line button { padding:4px 8px; min-height:44px; background:transparent; cursor:pointer; }
.command-path { margin-top:10px!important; color:#c4cfd4; text-transform:none; letter-spacing:.03em; }
.command-path b { color:var(--j-signal); font-weight:540; }
.console-links { display:flex; flex-wrap:wrap; gap:2px 15px; margin-top:16px; }
.console-links a { display:inline-flex; min-height:44px; align-items:center; gap:5px; }
.console-links a:hover { text-decoration:underline; }
.console-links a span { color:#b6d5ce; }
.observatory-body { width:min(47vw,640px); }
.readout { margin-top:20px; }
.feed-sample { display:flex; justify-content:space-between; align-items:center; min-height:40px; gap:12px; margin-bottom:6px; }
.sample-value { display:flex; align-items:baseline; gap:10px; }
.sample-value span, .feed-sample button { color:var(--j-faint); font:500 11px/1.4 var(--j-mono); }
.sample-value strong { color:var(--j-ink); font:500 21px/1 var(--j-mono); font-variant-numeric:tabular-nums; }
.sample-value small { color:var(--j-faint); font-size:10px; }
.feed-sample button { margin-left:auto; display:flex; align-items:center; gap:6px; min-height:38px; cursor:pointer; }
.feed-sample button:disabled { opacity:.5; }
.readout-scale { height:7px; border-bottom:1px solid var(--j-line);
  background:repeating-linear-gradient(90deg,var(--j-line) 0 1px,transparent 1px 12px) no-repeat 0 0 / 100% 3px; }
.reading { min-height:40px; padding:5px 0; display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid #abd4df35; }
.reading > div { min-width:0; display:grid; gap:1px; }
.read-name { font-size:14px; font-weight:500; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.reading small { color:var(--j-faint); font-size:9px; letter-spacing:.06em; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.reading strong { color:var(--j-signal); font:500 12px/1.4 var(--j-mono); }
.reading:is([data-state=error],[data-state=failed],[data-state=degraded]) strong { color:#ffccae; }
.no-readings { padding:14px 0; color:var(--j-faint); font-size:14px; }
.read-pages { display:flex; align-items:center; justify-content:flex-end; gap:8px; color:var(--j-faint); }
.read-pages button { min-width:36px; min-height:38px; font-size:14px; color:var(--j-ink); cursor:pointer; }
.read-pages button:disabled { opacity:.4; }
.is-reduced .art-plane { transform:translate(-50%,-50%) translateX(var(--plane-x)); }
@media (max-width:760px) {
  .manifest-copy, .archive-copy, .console-body, .observatory-body {
    left:clamp(20px,6vw,40px); width:calc(100% - clamp(40px,12vw,80px)); max-width:none;
  }
  .manifest-copy { top:auto; bottom:19%; }
  .manifest-copy h2 { font-size:clamp(43px,min(12vw,10vh),80px); }
  .archive-copy { top:auto; bottom:15%; }
  .archive-copy h2, .console-body h2, .observatory-body h2 { margin:8px 0; font-size:clamp(31px,8vw,49px); }
  .archive-depth { perspective:660px; perspective-origin:50% 44%; }
  .art-plane { width:clamp(175px,66vw,350px); left:53%; top:38%; }
  .console-body, .observatory-body { top:auto; translate:none; bottom:15%; }
  .command,.readout { margin-top:12px; }
  .console-links { gap:0 12px; margin-top:6px; }
  .j-outline { margin-top:9px; }
  .readout { max-width:470px; }
}
@media (max-height:580px) {
  .manifest-copy, .console-body, .observatory-body { top:50%; bottom:auto; translate:0 -50%; }
  .archive-copy { bottom:16%; }
  .j-scene .j-caption { display:none; }
  .manifest-copy h2 { font-size:clamp(36px,10vh,60px); }
  .archive-copy h2, .console-body h2, .observatory-body h2 { font-size:clamp(24px,7vh,38px); margin:6px 0; }
  .command, .readout, .console-links { margin-top:6px; }
  .feed-sample { min-height:26px; margin-bottom:2px; } .feed-sample button { min-height:28px; }
  .no-readings { padding:6px 0; }
  .reading { min-height:26px; padding:2px 0; }
  .read-pages button { min-height:26px; }
  .console-links a, .j-outline { min-height:36px; }
  .art-plane { width:min(28vw,53vh); }
}
</style>

<style>
/* The DOM cylinder is strictly a context-loss / GPU-less alternative; never
   stamp prepainted cards over the live scene's physical optical surfaces. */
.signal:has(.journey-world[data-renderer="webgl"] canvas[data-archive-optics="ready"]) .archive-depth { display:none; }
.signal[data-motion="off"] .art-plane img { animation-play-state:paused; }
@media (prefers-reduced-motion: reduce) { .art-plane img { animation:none; } }
</style>
