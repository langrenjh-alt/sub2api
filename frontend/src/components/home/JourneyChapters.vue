<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { Button } from '@/components/ui/button'
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
function layer(i: number) {
  const q = phase(i)
  if (props.reduced) return { visibility: chapter.value === i ? 'visible' as const : 'hidden' as const, opacity: chapter.value === i ? 1 : 0 }
  const opacity = ease((q + .045)/.14) * (i === 3 ? 1 : 1 - ease((q - .91)/.14))
  return { visibility: opacity <= 0 ? 'hidden' as const : 'visible' as const, opacity }
}
function lift(i: number) {
  if (props.reduced) return undefined
  const q = phase(i)
  const enter = 1 - ease(q/.21), depart = i === 3 ? 0 : ease((q-.85)/.20)
  return { transform: `translate3d(0,${enter*30-depart*20}px,0)` }
}
function lineStyle(index: number) {
  if (props.reduced) return undefined
  const enter = ease((phase(0)*1.8 - index*.11)/.50)
  return { opacity: enter, transform: `translate3d(${(1-enter)*-30}px,${(1-enter)*42}px,0) rotateX(${(1-enter)*45}deg)` }
}

const specimens = [
  { name:'Claude', code:'MESSAGES', image:'corona', number:'01' },
  { name:'GPT', code:'CHAT COMPLETIONS', image:'strata', number:'02' },
  { name:'Gemini', code:'GENERATE CONTENT', image:'interference', number:'03' },
] as const
function specimenStyle(index: number) {
  const f = clamp(phase(1)) * 2.88 - .40
  if (props.reduced) {
    // Reduced motion uses three discrete plates; never slide or scale one across the lens.
    const current = Math.min(2, Math.floor(clamp(phase(1)) * 3))
    return { opacity: index === current ? 1 : 0, zIndex: 20-index, '--plane-x': '0vw' }
  }
  const d = index - f
  // Each plate approaches the lens from the far right, passes the sculpture,
  // and leaves the viewport close to the camera on the opposite side.
  const u = clamp(d,-1.45,2.1)
  const visible = ease((d + 1.45)/.42) * (1-ease((d-1.64)/.65))
  const near = Math.max(0,-u)
  return {
    opacity: visible, zIndex: 20-index,
    '--plane-x': `${u*28 - near*near*10}vw`,
    '--plane-y': `${u*-4 + Math.sin(index*1.8)*2}vh`,
    '--plane-z': `${-u*335 - 15}px`,
    '--plane-yaw': `${u*-39 + 5}deg`,
    '--plane-roll': `${u*3.4 - 1.1}deg`,
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
    <section class="j-scene manifest" data-journey="manifesto" :style="layer(0)"
      :inert="chapter !== 0 ? true : undefined" :aria-hidden="chapter !== 0" aria-labelledby="j-manifest">
      <div class="manifest-copy">
        <p class="folio"><i></i>01 / TRANSMISSION</p>
        <h2 id="j-manifest">
          <span><b :style="lineStyle(0)">{{ t('home.journey.manifestoA') }}</b></span>
          <span><b :style="lineStyle(1)">{{ t('home.journey.manifestoB') }}</b></span>
        </h2>
        <p class="j-caption" :style="lift(0)">{{ t('home.journey.manifestoText') }}</p>
      </div>
    </section>

    <section class="j-scene archive" data-journey="gallery" :style="layer(1)"
      :inert="chapter !== 1 ? true : undefined" :aria-hidden="chapter !== 1" aria-labelledby="j-archive">
      <div class="archive-depth" aria-hidden="true">
        <figure v-for="(specimen,index) in specimens" :key="specimen.name" class="art-plane"
          :style="specimenStyle(index)">
          <img :src="`/assets/home/z30-archive-${specimen.image}.webp`" width="688" height="484" alt="" />
          <figcaption>
            <span class="art-index">A—{{ specimen.number }}</span>
            <strong>{{ specimen.name }}</strong>
            <small>{{ specimen.code }}</small>
          </figcaption>
        </figure>
      </div>
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
  position:absolute; z-index:2; inset:0; pointer-events:none;
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
.archive-depth { position:absolute; inset:0; perspective:820px; perspective-origin:60% 49%; transform-style:preserve-3d; }
.art-plane {
  position:absolute; left:55%; top:44%; width:clamp(220px,32vw,520px); aspect-ratio:688 / 484;
  transform:translate(-50%,-50%) translate3d(var(--plane-x),var(--plane-y),var(--plane-z)) rotateY(var(--plane-yaw)) rotateZ(var(--plane-roll));
  border:1px solid rgba(230,241,240,.35); border-radius:3px; overflow:hidden;
  box-shadow:1px 0 #a2b4bf80,4px 2px #222c3d,10px 24px 75px #03080c75; background:#19242a;
}
.art-plane img { width:100%; height:100%; object-fit:cover; }
.art-plane figcaption { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end;
  padding:5%; text-shadow:0 2px 15px #030708; background:linear-gradient(transparent 48%,rgba(1,8,12,.56)); }
.art-index { position:absolute; top:6%; left:5%; color:#e9f5f0; }
.art-plane strong { font-size:clamp(27px,3vw,52px); line-height:1; letter-spacing:-.05em; font-weight:500; }
.art-plane small { margin-top:7px; font-size:9px; }
.archive-copy { left:clamp(25px,6vw,120px); bottom:18%; max-width:min(29vw,400px); }
.archive-copy h2, .console-body h2, .observatory-body h2 { margin:13px 0 12px; font-size:clamp(34px,min(4.4vw,8.2vh),84px); }
.archive-copy::before, .console-body::before, .observatory-body::before {
  content:''; z-index:-1; position:absolute; inset:-30% -19%; pointer-events:none;
  background:radial-gradient(ellipse at center,rgba(3,9,13,.82),transparent 69%);
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
  .art-plane { width:clamp(170px,61vw,340px); left:49%; top:38%; }
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
