<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { irisChapterStart } from './journey/path'
import { Button } from '@/components/ui/button'
import { blend, galleryAngle, galleryWorks, panelWindow, editionIndex } from './journey/galleryPath'
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
const chapters = [[.15,.32], [.32,.55], [.55,irisChapterStart], [irisChapterStart,1]] as const
const chapter = computed(() => props.progress < .15 ? -1 : props.progress < .32 ? 0 : props.progress < .55 ? 1 : props.progress < irisChapterStart ? 2 : 3)
const phase = (i: number) => (props.progress - chapters[i][0]) / (chapters[i][1] - chapters[i][0])
const editorialWindows = [[.147,.182,.235,.281], [.315,.352,.50,.544], [.590,.616,.683,.720], [.925,.954,1.03,1.08]] as const
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
    // The CTA and endpoint belong to one readable block. Introduce it
    // after the outgoing sheet clears instead of cropping glyphs mid-line.
    clipPath: i === 2 ? 'none' : `polygon(0 0, 100% 0, 100% ${102-cut}%, 0 ${102-cut*.83}%)`,
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
    const current=editionIndex(p)
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
const edition = computed(() => galleryWorks[editionIndex(props.progress)])
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
        <figure v-for="(specimen,index) in galleryWorks" :key="specimen.name" class="art-plane" :data-format="specimen.format"
          :style="[specimenStyle(index), { '--sheet-aspect':String(specimen.aspect), '--crop-x':`${specimen.crop[0]*100}%`, '--crop-y':`${(1-specimen.crop[1])*100}%` }]">
          <img :src="fallbackPresence > 0 ? `/assets/home/atelier-${specimen.image}.webp` : undefined" decoding="async" width="688" height="484" alt="" />
          <figcaption>
            <span class="art-index">Z30 &nbsp;/&nbsp; {{ specimen.number }}</span>
            <strong>{{ specimen.name }}</strong>
            <small>{{ specimen.code }}</small>
          </figcaption>
        </figure>
      </div>
    <section class="j-scene manifest" data-journey="manifesto" :style="layer(0)"
      :inert="chapter !== 0 ? true : undefined" :aria-hidden="chapter !== 0" aria-labelledby="j-manifest">
      <div class="manifest-copy" :style="lift(0)">
        <p class="folio"><span>01</span> GATEWAY</p>
        <h2 id="j-manifest">
          <span><b :style="lineStyle(0)">{{ t('home.journey.manifestoA') }}</b></span>
          <span><b :style="lineStyle(1)">{{ t('home.journey.manifestoB') }}</b></span>
        </h2>
        <p class="j-caption">{{ t('home.journey.manifestoText') }}</p>
        <RouterLink class="manifest-action" :to="workspacePath">
          {{ authenticated ? t('home.journey.enter') : t('home.journey.signIn') }}
          <Icon name="arrowRight" size="sm" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <section class="j-scene archive" data-journey="gallery" :style="layer(1)"
      :inert="chapter !== 1 ? true : undefined" :aria-hidden="chapter !== 1" aria-labelledby="j-archive">
      <div class="archive-copy" :style="lift(1)">
        <p class="folio"><span>02</span> MODEL LIBRARY</p>
        <h2 id="j-archive">{{ t('home.journey.galleryTitle') }}</h2>
        <div class="edition-caption">
          <span class="edition-folio">Nº {{ edition.number }} <i>/</i> {{ String(galleryWorks.length).padStart(2,'0') }}</span>
          <span class="edition-model">{{ edition.name }}</span>
          <small>{{ edition.code }}</small>
        </div>
        <Button v-if="modelPlaza" as-child variant="outline" class="j-link j-outline">
          <RouterLink to="/model-plaza" class="home-model-plaza-cta">
            {{ t('home.journey.browse') }} <Icon name="arrowRight" size="sm" aria-hidden="true" />
          </RouterLink>
        </Button>
        <Button v-else as-child variant="outline" class="j-link j-outline">
          <a href="#connect">{{ t('home.landing.sections.accessSteps') }}
            <Icon name="arrowRight" size="sm" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>

    <section class="j-scene connection" data-journey="access" :style="layer(2)"
      :inert="chapter !== 2 ? true : undefined" :aria-hidden="chapter !== 2" aria-labelledby="j-connect">
      <div class="console-body" :style="lift(2)">
        <p class="folio"><span>03</span> API ACCESS</p>
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
            <span class="command-path"><b>POST</b> /chat/completions</span>
          </div>
          <div class="endpoint-line">
            <code>{{ endpoint.endpoint }}</code>
            <button type="button" :aria-label="t('home.journey.copyEndpoint')" @click="copyToClipboard(endpoint.endpoint)">
              {{ copied ? t('common.copied') : t('common.copy') }}
            </button>
          </div>
        </div>
        <div class="console-links">
          <RouterLink :to="keysPath" class="key-main">
            {{ t('home.journey.keys') }} <Icon name="arrowRight" size="sm" aria-hidden="true" />
          </RouterLink>
          <RouterLink to="/key-usage">{{ t('home.journey.usage') }} <span>↗</span></RouterLink>
          <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }} <span>↗</span></a>
          <a v-if="rechargeUrl" :href="rechargeUrl" target="_blank" rel="noopener noreferrer">{{ t('home.landing.nav.recharge') }} <span>↗</span></a>
        </div>
      </div>
    </section>

    <section class="j-scene observatory" data-journey="observatory" :style="layer(3)"
      :inert="chapter !== 3 ? true : undefined" :aria-hidden="chapter !== 3" aria-labelledby="j-observe">
      <div class="observatory-body" :style="lift(3)">
        <p class="folio"><span>04</span> SERVICE STATUS</p>
        <h2 id="j-observe">{{ t('home.journey.finalTitle') }}</h2>
        <p class="j-caption">{{ t('home.journey.statusIntro') }}</p>
        <div class="readout" :data-feed="statusState" :data-testid="records.length ? 'homepage-status-section' : undefined">
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
  --j-ink:#f4f1e9; --j-faint:#cacac6; --j-line:rgba(211,211,203,.34); --j-signal:#d6ac90;
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
  font:500 10px/1.35 var(--j-mono); letter-spacing:.095em; text-transform:uppercase;
}
 .folio { color:var(--j-faint); display:flex; align-items:center; gap:12px; font-weight:450; letter-spacing:.15em; }
.folio span { color:var(--j-signal); font:italic 18px/1 Georgia,serif; letter-spacing:0; padding-right:13px; border-right:1px solid #c4b19c7a; }
.j-scene h2 { font-weight:580; letter-spacing:-.065em; line-height:1.04; text-wrap:balance; }
.j-caption { color:var(--j-faint); font-size:clamp(13px,1.12vw,17px); line-height:1.55; max-width:44ch; }
.manifest-copy, .archive-copy, .console-body, .observatory-body {
  position:absolute; left:clamp(25px,8vw,154px); text-shadow:0 2px 23px rgba(0,0,0,.68);
}
.manifest-copy { top:30%; width:min(70vw,940px); }
.manifest-copy h2 { margin:24px 0 20px; font-size:clamp(53px,min(7.35vw,12.1vh),132px); line-height:1.02; }
.manifest-copy h2 span { display:block; overflow:hidden; padding-bottom:.055em; }
.manifest-copy h2 b { display:block; font-weight:inherit; transform-origin:0 90%; }
.manifest-copy h2 span:last-child { color:#d9d6d0; padding-left:.26em; }
.manifest-action { display:inline-flex; align-items:center; gap:23px; min-height:44px; margin-top:12px;
  border-bottom:1px solid #dedbd5; color:var(--j-ink); font-weight:550; font-size:14px; }
.manifest-action:hover svg { transform:translateX(3px); }
.j-scene[inert] .manifest-action { visibility:hidden; }
.manifest-copy .j-caption { max-width:41ch; }
.archive-depth {
  position:absolute; inset:0; z-index:4; perspective:850px; perspective-origin:64% 46%; transform-style:preserve-3d;
  pointer-events:none; overflow:clip;
}
.art-plane {
  position:absolute; left:60%; top:42%; width:clamp(235px,45vw,690px); aspect-ratio:var(--sheet-aspect,1.6);
  transform:translate(-50%,-50%) translate3d(var(--plane-x),var(--plane-y),var(--plane-z)) rotateY(var(--plane-yaw)) rotateZ(var(--plane-roll));
  overflow:hidden; background:rgba(25,25,25,.23); backdrop-filter:blur(1.1px) saturate(.9);
}
.art-plane[data-format=folio] {width:clamp(190px,32vw,460px)}
.art-plane[data-format=panorama] {width:clamp(250px,48vw,760px)}
.art-plane img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:var(--crop-x) var(--crop-y);
  opacity:.94; mask-image:linear-gradient(to right,#000 0%,#000 84%,#0004);
  animation:archive-flow 18s ease-in-out alternate infinite; }
.art-plane[data-format=folio] img {mask-image:linear-gradient(to left,#000 0%,#000 90%,#0004)}
.art-plane[data-format=panorama] img {mask-image:linear-gradient(to top,#000 0%,#000 91%,#0005)}
.art-plane:nth-child(even) img { animation-direction:alternate-reverse; animation-duration:23s; }
@keyframes archive-flow { from { transform:scale(1.035) translate(-.8%,.5%); } to { transform:scale(1.105) translate(.9%,-1.2%); } }
.art-plane::after { content:''; position:absolute; inset:0; pointer-events:none;
  box-shadow:inset 0 0 0 1px #c9c9be3a; background:linear-gradient(120deg,transparent 17%,#dedbd30a 48%,transparent 63%); }
.art-plane figcaption { position:absolute; inset:0; display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-end;
  padding:5.4%; text-shadow:0 1px 6px #14141799; background:linear-gradient(transparent 55%,#10101466); }
.art-index { position:absolute; top:8%; left:5.2%; color:#f2ece3; }
.art-plane strong { order:2; font-size:clamp(37px,5.2vw,80px); line-height:1; letter-spacing:-.07em; font-weight:570; }
.art-plane small { order:1; margin-bottom:8px; font-size:10px; }
.art-plane[data-format=panorama] figcaption { align-items:flex-end; }
.art-plane[data-format=panorama] strong { font:italic clamp(40px,5.4vw,88px)/1 Georgia,serif; letter-spacing:-.055em; }
.manifest { z-index:2; }
.archive { z-index:5; }
.connection,.observatory {z-index:3}
.j-scene[inert] .j-link,.j-scene[inert] .console-links,.j-scene[inert] .feed-sample button { visibility:hidden; }
.is-reduced .art-plane img { animation:none; }
.archive-copy { left:clamp(26px,6vw,118px); bottom:17.7%; max-width:min(30vw,450px); }
.archive-copy h2, .console-body h2, .observatory-body h2 { margin:13px 0 12px; font-size:clamp(34px,min(4.4vw,8.2vh),84px); }
.archive::before, .connection::before, .observatory::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 47% 43% at 23% 53%,#080a0c80,transparent 100%);
}
.archive::before { background:radial-gradient(ellipse 34% 34% at 17% 76%,#09090b91,transparent 100%); }
.edition-caption { display:grid; grid-template-columns:auto 1fr; width:max-content; max-width:100%;
  align-items:baseline; column-gap:13px; row-gap:2px; margin:17px 0 0; }
.edition-folio { grid-row:1/3; font:italic 18px/1.25 Georgia,serif; letter-spacing:-.02em; color:#e6ded2; }
.edition-folio i { margin:0 1px; color:var(--j-signal); font-style:normal; }
.edition-model { font-size:17px; font-weight:550; letter-spacing:-.035em; }
.edition-caption small { color:var(--j-faint); font:500 9px/1.4 var(--j-mono); letter-spacing:.065em; }
.j-outline { margin-top:16px; min-height:44px; padding:0 0 1px; gap:22px; border:none; border-radius:0;
  border-bottom:1px solid #e5d9cf; color:var(--j-ink); background:transparent; font-weight:550; box-shadow:none; }
.j-outline:hover { color:#fff; background:#f4eee708; }
.j-enter { margin-top:19px; padding:0 16px; border-bottom:0; color:#1c1c1c; background:var(--j-ink); }
.j-enter:hover { color:#121212; background:#fff; }
.console-body, .observatory-body { top:50%; translate:0 -50%; width:min(49vw,680px); }
.console-body { left:clamp(25px,7vw,130px); }
.command { margin-top:25px; max-width:570px; }
.endpoint-label { display:flex; align-items:center; gap:12px; color:var(--j-faint); }
.endpoint-label select {
  min-height:32px; max-width:100%; cursor:pointer; color:#f5f2ec; background:#222322; border:1px solid var(--j-line);
  border-radius:3px; padding:0 6px; font:500 12px/1.4 var(--j-mono); letter-spacing:0;
}
.endpoint-label label { max-width:70%; }
.command-line { flex:1; height:1px; background:var(--j-line); }
.endpoint-line { display:flex; gap:10px; align-items:center; border-bottom:1px solid var(--j-line); padding-bottom:3px; }
.endpoint-line code { overflow:auto; white-space:nowrap; flex:1; min-width:0; padding:10px 0; font:450 clamp(15px,1.65vw,26px)/1.4 var(--j-mono); letter-spacing:-.055em; }
.endpoint-line button, .console-links a { color:var(--j-ink); font-size:13px; }
.endpoint-line button { padding:4px 8px; min-height:44px; background:transparent; cursor:pointer; }
.command-path { color:var(--j-faint); text-transform:none; letter-spacing:.03em; }
.command-path b { color:var(--j-signal); font-weight:540; }
.console-links { display:flex; flex-wrap:wrap; gap:3px 15px; align-items:center; margin-top:20px; }
.console-links a { display:inline-flex; min-height:44px; align-items:center; gap:5px; }
.console-links a:hover { text-decoration:underline; }
.console-links a span { color:var(--j-signal); }
.console-links .key-main { padding:0 14px; gap:16px; border:1px solid #eee6d8; background:var(--j-ink);
  color:#171918; text-shadow:none; font-weight:600; text-decoration:none; }
.console-links .key-main:hover { text-decoration:none; background:#fff; }

.observatory-body { width:min(47vw,640px); }
.readout { margin-top:20px; }
.feed-sample { display:flex; justify-content:space-between; align-items:end; min-height:42px; gap:12px; margin-bottom:9px; }
.sample-value { display:flex; flex-direction:column; align-items:start; gap:3px; }
.sample-value span, .feed-sample button { color:var(--j-faint); font:500 11px/1.4 var(--j-mono); }
.sample-value strong { color:var(--j-ink); font:480 clamp(29px,3vw,44px)/1.05 'Geist Variable',sans-serif; letter-spacing:-.065em; font-variant-numeric:tabular-nums; }
.sample-value small { color:var(--j-faint); font-size:10px; }
.feed-sample button { margin-left:auto; display:flex; align-items:center; gap:6px; min-height:38px; cursor:pointer; }
.feed-sample button:disabled { opacity:.5; }
.readout-scale { height:1px; background:var(--j-line); }
.reading { min-height:40px; padding:5px 0; display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid #dacfb532; }
.reading > div { min-width:0; display:grid; gap:1px; }
.read-name { font-size:14px; font-weight:500; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.reading small { color:var(--j-faint); font-size:9px; letter-spacing:.06em; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.reading strong { color:var(--j-ink); font:500 12px/1.4 var(--j-mono); }
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
  .manifest-copy h2 { font-size:clamp(44px,min(12.4vw,10.4vh),82px); }
  .archive-copy { top:auto; bottom:15%; }
  .archive-copy h2, .console-body h2, .observatory-body h2 { margin:8px 0; font-size:clamp(31px,8vw,49px); }
  .archive-depth { perspective:660px; perspective-origin:50% 44%; }
  .art-plane { width:clamp(190px,76vw,405px); left:53%; top:38%; }
  .art-plane[data-format=folio] {width:clamp(155px,57vw,335px)}
  .art-plane[data-format=panorama] {width:clamp(218px,82vw,440px)}
  .console-body, .observatory-body { top:auto; translate:none; bottom:15%; }
  .command,.readout { margin-top:12px; }
  .console-links { gap:0 12px; margin-top:6px; }
  .j-outline { margin-top:10px; }
  .edition-caption { margin-top:8px; }
  .readout { max-width:470px; }
}
@media (max-height:580px) {
  .manifest-copy, .console-body, .observatory-body { top:50%; bottom:auto; translate:0 -50%; }
  .archive-copy { bottom:16%; }
  .j-scene .j-caption { display:none; }
  .manifest-copy h2 { font-size:clamp(36px,10vh,60px); }
  .archive-copy h2, .console-body h2, .observatory-body h2 { font-size:clamp(24px,7vh,38px); margin:6px 0; }
  .command, .readout, .console-links { margin-top:6px; }
  .feed-sample { min-height:26px; margin-bottom:2px; } .sample-value { flex-direction:row; align-items:baseline; gap:9px; } .sample-value strong { font-size:20px; } .feed-sample button { min-height:28px; }
  .no-readings { padding:6px 0; }
  .reading { min-height:26px; padding:2px 0; }
  .read-pages button { min-height:26px; }
  .console-links a, .j-outline { min-height:36px; }
  .art-plane { width:min(34vw,65vh); }
  .art-plane[data-format=folio] {width:min(24vw,48vh)}
}
</style>

<style>
/* The DOM cylinder is strictly a context-loss / GPU-less alternative; never
   stamp prepainted cards over the live scene's physical optical surfaces. */
.signal:has(.journey-world[data-renderer="webgl"] canvas[data-archive-optics="ready"]) .archive-depth { display:none; }
.signal[data-motion="off"] .art-plane img { animation-play-state:paused; }
@media (prefers-reduced-motion: reduce) { .art-plane img { animation:none; } }
</style>
