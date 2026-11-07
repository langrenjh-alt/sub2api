<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import GlassWordmark from './GlassWordmark.vue'
import SpatialField from './SpatialField.vue'
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
const pointerX = ref(0)
const pointerY = ref(0)
const paused = ref(false)
const reduced = ref(false)
const visible = ref(true)
const inView = ref(true)
const active = computed(() => !paused.value && !reduced.value && visible.value && inView.value)
let media: MediaQueryList | undefined
let observer: IntersectionObserver | undefined

function resetPerspective() {
  pointerX.value = 0; pointerY.value = 0
  scene.value?.style.setProperty('--dx', '0')
  scene.value?.style.setProperty('--dy', '0')
}

function move(event: PointerEvent) {
  if (!active.value || event.pointerType === 'touch' || !scene.value) return
  const rect = scene.value.getBoundingClientRect()
  pointerX.value = (event.clientX - rect.left) / rect.width * 2 - 1
  pointerY.value = (event.clientY - rect.top) / rect.height * 2 - 1
  scene.value.style.setProperty('--dx', pointerX.value.toFixed(3))
  scene.value.style.setProperty('--dy', pointerY.value.toFixed(3))
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
    <SpatialField :active="active" :pointer-x="pointerX" :pointer-y="pointerY" />

    <header class="signal-header">
      <RouterLink to="/home" class="signal-brand">
        <img :src="siteLogo || '/logo.svg'" alt="" width="32" height="32" />
        <span>{{ brandName }}</span>
      </RouterLink>
      <div class="signal-tools">
        <LocaleSwitcher />
        <nav class="signal-nav" :aria-label="t('home.signal.navigation')">
          <a href="#actions" class="signal-nav-entry">{{ t('home.signal.index') }}</a>
          <RouterLink v-if="modelPlaza" class="signal-nav-entry home-model-plaza-nav" to="/model-plaza">{{ t('nav.modelPlaza') }}</RouterLink>
          <span class="signal-nav-rule" aria-hidden="true"></span>
          <Button variant="ghost" as-child class="signal-login">
            <RouterLink :to="workspacePath">
              {{ authenticated ? t('home.dashboard') : t('home.login') }}
              <Icon name="arrowRight" size="sm" aria-hidden="true" />
            </RouterLink>
          </Button>
        </nav>
      </div>
    </header>

    <span class="signal-scroll-cue" aria-hidden="true">{{ t('home.signal.scroll') }}</span>
    <div class="signal-core">
      <GlassWordmark :active="active" :pointer-x="pointerX" :pointer-y="pointerY" />
    </div>

    <footer class="signal-footer">
      <div class="signal-caption">
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
.signal-plate, .signal-vignette {
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
.signal-header {
  z-index: 3; display: flex; justify-content: space-between;
  align-items: center; min-height: 92px; gap: 20px;
}
.signal-brand, .signal-tools, .signal-nav, .signal-login, .signal-explore, .signal-motion button {
  display: flex; align-items: center;
}
.signal-brand { min-width: 0; width: fit-content; max-width: 100%; gap: 10px; font-size: 16px; font-weight: 650; letter-spacing: -.04em; color: var(--silver); }
.signal-brand img { flex: none; width: 32px; height: 32px; object-fit: contain; }
.signal-brand span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.signal-nav {
  gap: clamp(12px, 1.2vw, 22px); padding: 0 14px 0 20px;
  border: 1px solid #749d9559; border-radius: 999px;
  background: #070d10bb; box-shadow: 0 5px 24px -16px #a3f4d4;
}
.signal-nav-rule { width: 24px; height: 1px; background: #aac6c280; }
.signal-nav a { display: inline-flex; align-items: center; min-height: 44px; color: var(--caption); font-size: 13px; }
.signal-tools { justify-content: flex-end; gap: 14px; }
.signal-tools :deep(.relative > button) { min-height: 44px; color: var(--caption); }
.signal-tools :deep(.relative > button:hover) { background: #ffffff0e; }
.signal-header .signal-login { min-height: 44px; padding: 0 4px; color: var(--silver); background: transparent; font-size: 12px; gap: 8px; }
.signal-header .signal-login:hover { color: white; }
.signal-nav a:hover, .signal-explore:hover, .signal-motion button:hover { color: white; }
.signal :is(a,button):focus-visible { outline: 2px solid var(--spark); outline-offset: 4px; }
.signal-scroll-cue {
  position: absolute; left: 50%; top: 32%; transform: translateX(-50%);
  font: 10px/1.4 var(--mono); letter-spacing: .15em; text-transform: uppercase; color: #9db8b6;
}
.signal-core {
  position: absolute; left: 50%; top: 50%; width: clamp(215px, min(30vw, 64vh), 520px);
  transform: translate(-50%, -50%); pointer-events: none;
}
.signal-footer {
  grid-row: 3; z-index: 1; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end;
  gap: 24px; padding: 30px 0 max(36px, env(safe-area-inset-bottom)); text-shadow: 0 1px 14px #03070b;
}
.signal-caption { max-width: 400px; }
.signal-explore, .signal-motion button, .signal-still {
  font: 10px/1.4 var(--mono); letter-spacing: .10em; text-transform: uppercase;
}
.signal-caption p { margin: 0; max-width: 35ch; color: var(--caption); font-size: clamp(13px,1vw,16px); font-weight: 430; line-height: 1.45; text-wrap: balance; overflow-wrap: anywhere; }
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


@media (max-width: 780px) {
  .signal-header { display: flex; justify-content: space-between; gap: 12px; min-height: 74px; }
  .signal-nav { padding: 0 13px; }
  .signal-nav .signal-nav-entry, .signal-nav-rule { display: none; }
  .signal-tools { gap: 4px; flex: none; }
  .signal-footer { grid-template-columns: 1fr auto; gap: 14px; padding-bottom: max(18px, env(safe-area-inset-bottom)); }
  .signal-caption { grid-column: 1 / -1; }
  .signal-explore { justify-self: start; }
  .signal-core { width: clamp(164px, 52vw, 310px); }
}
@media (prefers-reduced-motion: reduce) {
  .signal *, .signal ::before, .signal ::after { animation: none !important; transition: none !important; }
}
</style>
