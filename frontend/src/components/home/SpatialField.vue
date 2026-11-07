<script setup lang="ts">
/**
 * Camera-space dust over the baked optical field. The plate uses the same
 * 16:9 film gate; mobile crops the gate rather than flattening its perspective.
 * This transparent pass deliberately does not allocate a second WebGL context.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  active: boolean
  pointerX?: number
  pointerY?: number
}>(), { pointerX: 0, pointerY: 0 })
const canvas = ref<HTMLCanvasElement>()
const colours = ['115,177,251', '134,210,196', '202,223,174'] as const
let context: CanvasRenderingContext2D | null = null
let resize: ResizeObserver | undefined
let frame = 0
let w = 0, h = 0, elapsed = 0, last = 0, cameraX = 0, cameraY = 0
const textures: HTMLCanvasElement[] = []

// Seeded trajectories are stable across visits and viewport changes.
let seed = 30037
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0
  return seed / 4294967296
}

const dust = Array.from({ length: 660 }, (_, i) => ({
  start: random(), phase: random() * Math.PI * 2,
  spread: (random() + random() + random() - 1.5),
  depth: random(), speed: .006 + random() *.009,
  radius: .5 + random()**3 * 2.8, light: .18 + random()**2 * .77,
  bank: (i % 5 === 0 ? 1 : 0), colour: i % 5 === 0 ? 0 : 1 + (i % 4 === 0 ? 1 : 0),
}))

function makeTextures() {
  for (const rgb of colours) {
    const disk = document.createElement('canvas')
    disk.width = disk.height = 48
    const c = disk.getContext('2d')
    if (!c) return
    const light = c.createRadialGradient(21, 20, 1, 24, 24, 22)
    for (const [r, a] of [[0, .97], [.12, .85], [.26, .29], [.5, .16], [.70, .07], [1, 0]]) {
      light.addColorStop(r, `rgba(${rgb},${a})`)
    }
    c.fillStyle = light
    c.fillRect(0, 0, 48, 48)
    textures.push(disk)
  }
}

function draw() {
  if (!context || !w || textures.length !== colours.length) return
  const ctx = context
  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'
  const filmW = Math.max(w, h * 16 / 9)
  const filmH = filmW * 9 / 16
  const count = w < 620 ? 350 : dust.length
  for (let i = 0; i < count; i++) {
    const p = dust[i]
    const t = (p.start + elapsed * p.speed) % 1
    const a = t * 7.8 + p.phase
    // Two intersecting currents. Their apparent widths decrease toward
    // the far end and their spirals expose opposite sides to the key light.
    const z = .82 + t * .93 + p.depth * .27 + Math.cos(a) * .12
    const s = 1 / z
    let u, v
    if (p.bank === 0) {
      u = .19 + .64 * t
      v = 1.17 - .49*t + .09*Math.sin(t*6.1)
      v += s * (.06*Math.sin(a) + p.spread * .032)
    } else {
      u = .405 - .136*Math.sin(t*3.3) + s*(.05*Math.sin(a) + p.spread*.022)
      v = -.08 + t*1.24
    }
    const sx = w*.5 + (u-.5)*filmW + cameraX*(s-.6)*25
    const sy = v*filmH + (h-filmH)*.68 + cameraY*(s-.6)*18
    if (sx < -8 || sx > w+8 || sy < -8 || sy > h+8) continue
    const r = p.radius * Math.min(1.5, filmW/1250) * s * 2.8
    const edge = Math.min(1, t*22, (1-t)*22)
    ctx.globalAlpha = p.light * edge * (.68 + .32*Math.cos(a)) * (p.bank && v < .55 ? .18 : .93)
    ctx.drawImage(textures[p.colour], sx-r, sy-r, r*2, r*2)
  }
  ctx.globalAlpha = 1
}

function tick(now: number) {
  frame = 0
  if (!props.active || !context) return
  // Motion is a secondary layer. Limit bandwidth, freeze time when paused,
  // and do not simulate missed frames when returning from a hidden tab.
  if (!last || now-last >= 1000/24) {
    const dt = last ? Math.min(.08, (now-last)/1000) : 0
    elapsed += dt
    const ease = 1 - Math.exp(-dt*4)
    cameraX += (props.pointerX-cameraX)*ease
    cameraY += (props.pointerY-cameraY)*ease
    last = now
    draw()
  }
  frame = requestAnimationFrame(tick)
}

function schedule() {
  cancelAnimationFrame(frame)
  frame = 0
  last = 0
  if (!context) return
  if (props.active) frame = requestAnimationFrame(tick)
  else draw()
}

function measure() {
  if (!context || !canvas.value) return
  w = canvas.value.clientWidth
  h = canvas.value.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
  canvas.value.width = Math.round(w*dpr)
  canvas.value.height = Math.round(h*dpr)
  context.setTransform(dpr,0,0,dpr,0,0)
  draw()
}

onMounted(() => {
  if (!canvas.value || !('CanvasRenderingContext2D' in window)) return
  context = canvas.value.getContext('2d', { alpha: true })
  if (!context) return
  makeTextures()
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(measure)
    resize.observe(canvas.value)
  }
  if (!resize) window.addEventListener('resize', measure)
  schedule()
})
watch(() => props.active, schedule)
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resize?.disconnect()
  window.removeEventListener('resize', measure)
  textures.length = 0
  context = null
})
</script>

<template><canvas ref="canvas" class="spatial-field" aria-hidden="true"></canvas></template>

<style scoped>
.spatial-field { position: absolute; inset: 0; z-index: -1; pointer-events: none; width: 100%; height: 100%; }
</style>
