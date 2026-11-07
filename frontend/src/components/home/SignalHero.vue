<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { Button } from '@/components/ui/button'

defineProps<{
  brandName: string
  siteLogo: string
  tagline: string
  workspacePath: string
  authenticated: boolean
  modelPlaza: boolean
}>()

const { t } = useI18n()
const scene = ref<HTMLElement>()
const paused = ref(false)
const reduced = ref(false)
const visible = ref(true)
const inView = ref(true)
const active = computed(() => !paused.value && !reduced.value && visible.value && inView.value)
let media: MediaQueryList | undefined
let observer: IntersectionObserver | undefined

const lights = Array.from({ length: 32 }, (_, n) => ({
  left: `${(n * 71.31 + 3) % 100}%`,
  top: `${(n * 31.09 + 13) % 90}%`,
  '--size': `${1.4 + ((n * 3.27) % 4)}px`,
  '--period': `${8 + n % 11}s`,
  animationDelay: `-${n * 1.73}s`,
}))

function resetPerspective() {
  scene.value?.style.setProperty('--dx', '0')
  scene.value?.style.setProperty('--dy', '0')
}

function move(event: PointerEvent) {
  if (!active.value || event.pointerType === 'touch' || !scene.value) return
  const rect = scene.value.getBoundingClientRect()
  scene.value.style.setProperty('--dx', ((event.clientX - rect.left) / rect.width * 2 - 1).toFixed(3))
  scene.value.style.setProperty('--dy', ((event.clientY - rect.top) / rect.height * 2 - 1).toFixed(3))
}

function syncPreferences() {
  reduced.value = media?.matches ?? false
  visible.value = !document.hidden
  if (reduced.value) resetPerspective()
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncPreferences()
  media.addEventListener?.('change', syncPreferences)
  document.addEventListener('visibilitychange', syncPreferences)
  if (scene.value && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => { inView.value = entry.isIntersecting })
    observer.observe(scene.value)
  }
})

onBeforeUnmount(() => {
  media?.removeEventListener?.('change', syncPreferences)
  document.removeEventListener('visibilitychange', syncPreferences)
  observer?.disconnect()
})
</script>

<template>
  <section ref="scene" class="signal" :data-motion="active ? 'on' : 'off'" aria-labelledby="z30-title"
    @pointermove="move" @pointerleave="resetPerspective">
    <img class="signal-plate" src="/assets/home/z30-signal-field.webp" alt="" fetchpriority="high" />
    <div class="signal-vignette" aria-hidden="true"></div>
    <div class="signal-motes" aria-hidden="true">
      <i v-for="(light, n) in lights" :key="n" :style="light"></i>
    </div>

    <header class="signal-header">
      <RouterLink to="/home" class="signal-brand">
        <img :src="siteLogo || '/logo.svg'" alt="" width="32" height="32" />
        <span>{{ brandName }}</span>
      </RouterLink>
      <nav class="signal-nav" :aria-label="t('home.signal.navigation')">
        <a href="#actions">{{ t('home.signal.index') }}</a>
        <a href="#compatibility">{{ t('home.landing.sections.compatibility') }}</a>
        <RouterLink v-if="modelPlaza" class="home-model-plaza-nav" to="/model-plaza">{{ t('nav.modelPlaza') }}</RouterLink>
      </nav>
      <div class="signal-tools">
        <LocaleSwitcher />
        <Button variant="outline" as-child class="signal-login">
          <RouterLink :to="workspacePath">
            {{ authenticated ? t('home.dashboard') : t('home.login') }}
            <Icon name="arrowRight" size="sm" aria-hidden="true" />
          </RouterLink>
        </Button>
      </div>
    </header>

    <div class="signal-axis" aria-hidden="true"><span>FIG. 01</span><i></i><span>FIELD STUDIES</span></div>
    <div class="signal-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="signal-core">
      <div class="signal-object">
        <h1 id="z30-title">
          <span class="signal-glass" aria-hidden="true"></span>
          <img src="/z30-emblem.svg" width="224" height="92" alt="Z30" />
        </h1>
      </div>
    </div>

    <footer class="signal-footer">
      <div class="signal-caption">
        <span class="signal-label"><b></b>SIGNAL FIELD <i>/</i> 001</span>
        <p>{{ tagline }}</p>
      </div>
      <a href="#actions" class="signal-explore">
        <span>{{ t('home.signal.explore') }}</span>
        <Icon name="arrowDown" size="sm" aria-hidden="true" />
      </a>
      <div class="signal-motion">
        <button v-if="!reduced" type="button" :aria-pressed="!paused" :aria-label="t('home.signal.motion')"
          @click="paused = !paused; resetPerspective()">
          <span class="signal-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
          {{ paused ? t('home.signal.resume') : t('home.signal.pause') }}
        </button>
        <span v-else class="signal-still">{{ t('home.signal.still') }}</span>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.signal {
  --dx: 0; --dy: 0; --silver: #edf3f2; --caption: #b8c7ce; --spark: #a1e6c3;
  --mono: 'Geist Mono Variable', ui-monospace, monospace;
  display: grid; grid-template-rows: auto 1fr auto; position: relative; isolation: isolate;
  box-sizing: border-box; min-height: max(570px, 100svh); padding: 0 clamp(22px, 4vw, 76px);
  overflow: hidden; color: var(--silver); background: #090e15;
}
.signal-plate, .signal-vignette, .signal-motes {
  position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;
}
.signal-plate {
  z-index: -3; object-fit: cover; object-position: center 68%;
  transform: translate(calc(var(--dx) * -5px), calc(var(--dy) * -4px)) scale(1.018);
  transition: transform 680ms ease-out;
}
.signal-vignette {
  z-index: -2;
  background: linear-gradient(to bottom, rgba(3,7,11,.55), transparent 22%, transparent 67%, rgba(3,8,12,.72)),
    radial-gradient(ellipse at center, transparent 40%, rgba(3,7,11,.28) 100%);
}
.signal-motes { z-index: -1; }
.signal-motes i {
  position: absolute; width: var(--size); height: var(--size); border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, #def7ed, #6eabb9 34%, #253e55 66%, transparent);
  opacity: .6; animation: current var(--period) ease-in-out infinite alternate;
}
@keyframes current { from { transform: translate(-8px, 5px); opacity: .18; } to { transform: translate(14px, -15px); opacity: .72; } }

.signal-header {
  z-index: 3; display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr);
  align-items: center; min-height: 92px; gap: 20px;
}
.signal-brand, .signal-tools, .signal-nav, .signal-login, .signal-explore, .signal-motion button {
  display: flex; align-items: center;
}
.signal-brand { min-width: 0; width: fit-content; max-width: 100%; gap: 10px; font-size: 16px; font-weight: 650; letter-spacing: -.04em; color: var(--silver); }
.signal-brand img { flex: none; width: 32px; height: 32px; object-fit: contain; }
.signal-brand span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.signal-nav { gap: clamp(16px, 2vw, 34px); }
.signal-nav a { display: inline-flex; align-items: center; min-height: 44px; color: var(--caption); font-size: 13px; }
.signal-tools { justify-content: flex-end; gap: 14px; }
.signal-tools :deep(.relative > button) { min-height: 44px; color: var(--caption); }
.signal-tools :deep(.relative > button:hover) { background: #ffffff0e; }
.signal-header .signal-login {
  min-height: 44px; border-radius: 100px; border: 1px solid #a6c5be55;
  padding: 0 18px; color: var(--silver); background: #0e181e80;
  box-shadow: none; font-size: 12px; gap: 13px;
}
.signal-header .signal-login:hover { background: #c2ebdb; color: #081612; }
.signal-nav a:hover, .signal-explore:hover, .signal-motion button:hover { color: white; }
.signal :is(a,button):focus-visible { outline: 2px solid var(--spark); outline-offset: 4px; }
.signal-axis, .signal-ticks { position: absolute; top: 48%; }
.signal-axis {
  left: clamp(22px, 4vw, 76px); display: flex; gap: 10px; align-items: center;
  writing-mode: vertical-rl; transform: translateY(-50%) rotate(180deg);
  color: #aebcc7; font: 9px/1 var(--mono); letter-spacing: .16em;
}
.signal-axis i { height: 26px; border-left: 1px solid #8fa5ad70; }
.signal-ticks {
  right: clamp(22px, 4vw, 76px); display: grid; justify-items: end; gap: 7px; transform: translateY(-50%);
}
.signal-ticks i { display: block; height: 1px; width: 5px; background: #90a0a955; }
.signal-ticks i:nth-child(4) { width: 18px; background: var(--spark); }
.signal-ticks i:is(:first-child,:last-child) { width: 10px; }
.signal-core {
  position: absolute; left: 50%; top: 50%; width: clamp(260px, min(44vw, 72vh), 710px);
  transform: translate(-50%, -50%); pointer-events: none; perspective: 900px;
}
.signal-object {
  position: relative;
  transform: rotateY(calc(var(--dx) * 7deg)) rotateX(calc(var(--dy) * -5deg));
  transition: transform 500ms cubic-bezier(.2,.7,.3,1);
}
.signal-object h1 { position: relative; margin: 0; color: var(--silver); }
.signal-object h1 img { position: relative; display: block; width: 100%; height: auto; }
/* The logo is just three transparent glyphs. The standalone SVG supplies its
   beveled edges. A second view of the same scene supplies the refracted light;
   both that surface and the live backdrop filter are clipped to the glyphs. */
.signal-glass {
  display: none; position: absolute; inset: 0;
  -webkit-mask: url('/z30-mono.svg') center / 100% 100% no-repeat;
  mask: url('/z30-mono.svg') center / 100% 100% no-repeat;
  -webkit-backdrop-filter: blur(.7px) saturate(1.65) contrast(1.18) brightness(1.55);
  backdrop-filter: blur(.7px) saturate(1.65) contrast(1.18) brightness(1.55);
}
@supports (mask-image: url("")) or (-webkit-mask-image: url("")) {
  .signal-glass { display: block; }
}
.signal-glass::before {
  content: ''; position: absolute; inset: -10%;
  background: url('/assets/home/z30-signal-field.webp') no-repeat;
  background-size: max(95vw, 150svh) auto;
  background-position: calc(50% + var(--dx) * 26px) calc(71% + var(--dy) * 16px);
  transform: skewX(-7deg) scaleY(-1); opacity: .49;
  filter: contrast(1.16) saturate(.85) brightness(1.65);
  transition: background-position 380ms ease-out;
}
.signal-glass::after {
  content: ''; position: absolute; inset: -60%;
  background: linear-gradient(125deg, transparent 30%, rgba(154,241,219,.02) 42%,
    rgba(198,240,255,.28) 46.5%, rgba(210,226,250,.04) 50%, transparent 61%);
  transform: translateX(calc(var(--dx) * 11%));
  transition: transform 400ms ease-out;
  animation: caustic 14s ease-in-out infinite alternate;
}
@keyframes caustic { from { translate: -12% 0; } to { translate: 12% 0; } }
.signal-footer {
  grid-row: 3; z-index: 1; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end;
  gap: 24px; padding: 30px 0 max(36px, env(safe-area-inset-bottom)); text-shadow: 0 1px 14px #03070b;
}
.signal-caption { max-width: 400px; }
.signal-label, .signal-explore, .signal-motion button, .signal-still {
  font: 10px/1.4 var(--mono); letter-spacing: .10em; text-transform: uppercase;
}
.signal-label { display: flex; align-items: center; gap: 9px; color: var(--caption); }
.signal-label b { width: 6px; height: 6px; background: var(--spark); border-radius: 50%; box-shadow: 0 0 12px #a4eec680; }
.signal-label i { color: #859598; font-style: normal; }
.signal-caption p { margin: 11px 0 0; max-width: 35ch; font-size: clamp(17px,1.6vw,25px); font-weight: 430; line-height: 1.28; text-wrap: balance; overflow-wrap: anywhere; }
.signal-explore { min-height: 44px; gap: 12px; color: var(--silver); }
.signal-explore svg { transition: transform .25s ease; }
.signal-explore:hover svg { transform: translateY(3px); }
.signal-motion { justify-self: end; }
.signal-motion button { min-height: 44px; gap: 10px; padding: 0; color: var(--caption); background: transparent; cursor: pointer; }
.signal-meter { height: 13px; display: flex; gap: 2px; align-items: center; }
.signal-meter i { width: 2px; height: 5px; background: var(--spark); }
.signal-meter i:nth-child(even) { height: 10px; }
.signal-meter i:nth-child(3) { height: 14px; }
.signal-motion button[aria-pressed=false] i { height: 2px; }
.signal-still { display: inline-flex; min-height: 44px; align-items: center; color: var(--caption); }
.signal[data-motion=off] .signal-motes i, .signal[data-motion=off] .signal-glass::after { animation-play-state: paused; }

@media (max-width: 780px) {
  .signal-header { display: flex; justify-content: space-between; gap: 12px; min-height: 74px; }
  .signal-nav { display: none; }
  .signal-tools { gap: 4px; flex: none; }
  .signal-footer { grid-template-columns: 1fr auto; gap: 14px; padding-bottom: max(18px, env(safe-area-inset-bottom)); }
  .signal-caption { grid-column: 1 / -1; }
  .signal-explore { justify-self: start; }
  .signal-core { width: clamp(200px, 68vw, 390px); }
  .signal-axis { display: none; }
  .signal-ticks { right: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .signal *, .signal ::before, .signal ::after { animation: none !important; transition: none !important; }
}
</style>
