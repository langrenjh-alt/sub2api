<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GlassScene } from './glass/scene'

const props=defineProps<{ active:boolean; pointerX:number; pointerY:number }>()
const canvas=ref<HTMLCanvasElement>()
const enhanced=ref(false)
let engine:GlassScene|undefined
const controller=new AbortController()

function lost(e:Event) {
  e.preventDefault()
  enhanced.value=false
  engine?.dispose(); engine=undefined
}
onMounted(async()=>{
  if (!canvas.value || typeof WebGL2RenderingContext==='undefined' || typeof ResizeObserver==='undefined' ||
    window.matchMedia('(forced-colors: active)').matches) return
  const host=canvas.value.closest<HTMLElement>('.signal')
  if (!host) return
  try {
    const {createGlassScene}=await import('./glass/scene')
    if (controller.signal.aborted || !canvas.value) return
    engine=await createGlassScene(canvas.value,host,controller.signal)
    if (controller.signal.aborted) {engine.dispose();return}
    canvas.value.addEventListener('webglcontextlost',lost)
    engine.input(props.pointerX,props.pointerY);engine.active(props.active)
    enhanced.value=true
  } catch {
    // Blocked WebGL, low resource budgets or an offline asset must not hide the logo.
    enhanced.value=false
  }
})
watch(()=>[props.pointerX,props.pointerY],([x,y])=>engine?.input(x,y))
watch(()=>props.active,on=>engine?.active(on))
onBeforeUnmount(()=>{
  controller.abort()
  canvas.value?.removeEventListener('webglcontextlost',lost)
  engine?.dispose();engine=undefined
})
</script>

<template>
  <h1 id="z30-title" class="wordmark" :data-renderer="enhanced ? 'webgl' : 'svg'">
    <img src="/z30-emblem.svg" width="224" height="92" alt="Z30" />
    <canvas ref="canvas" aria-hidden="true"></canvas>
  </h1>
</template>

<style scoped>
.wordmark { position: relative; margin: 0; width: 100%; aspect-ratio: 224 / 92; }
.wordmark img, .wordmark canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.wordmark canvas { opacity: 0; top: -25%; height: 150%; }
.wordmark[data-renderer='webgl'] canvas { opacity: 1; }
.wordmark[data-renderer='webgl'] img { opacity: 0; }
@media (forced-colors: active) {
  .wordmark[data-renderer] canvas { opacity: 0; }
  .wordmark[data-renderer] img { opacity: 1; }
}
</style>
