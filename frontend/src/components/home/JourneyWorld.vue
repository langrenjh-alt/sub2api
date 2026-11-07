<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { JourneyRenderer, WorldInput } from './journey/worldScene'

const props=defineProps<WorldInput>()
const canvas=ref<HTMLCanvasElement>()
const rendererMode=ref<'pending' | 'webgl' | 'still'>('pending')
const room=computed(()=>props.progress<.33?'estuary':props.progress<.565?'archive':props.progress<.79?'conduit':'observatory')
const alpha=computed(()=>Math.min(1,Math.max(0,(props.progress-.014)/.104)))
const rooms=['estuary','archive','conduit','observatory'] as const
const stops=[.23,.445,.68,.94]
const posterLayers=computed(()=>{
  const p=props.progress
  if(props.reduced)return [{room:room.value,opacity:1,scale:1}]
  return rooms.flatMap((id,i)=>{
    const enter=[0,.33,.565,.79][i],exit=[.33,.565,.79,1.10][i]
    const fade=(x:number)=>{const a=Math.min(1,Math.max(0,x));return a*a*(3-2*a)}
    const opacity=i===0?1:fade((p-enter+.034)/.068)
    // Only the incoming photograph fades; its predecessor stays fully
    // opaque underneath, so the GPU-free dissolve never dips to black.
    if(p < enter-.034 || p >= exit+.034 || opacity===0)return []
    return [{room:id,opacity,scale:Math.max(1,1.055+(p-stops[i])*.28)}]
  })
})
let engine:JourneyRenderer|null=null
let stopped=false
const feed=()=>engine?.update({progress:props.progress,active:props.active,reduced:props.reduced,pointerX:props.pointerX,pointerY:props.pointerY})
function lost(event:Event){ event.preventDefault();engine?.dispose();engine=null;rendererMode.value='still' }
async function create(){
  if(stopped||!canvas.value)return
  if(typeof WebGL2RenderingContext==='undefined'||window.matchMedia('(forced-colors: active)').matches){
    rendererMode.value='still';return
  }
  try {
    const { createJourneyRenderer }=await import('./journey/worldScene')
    if(stopped||!canvas.value)return
    engine=createJourneyRenderer(canvas.value);feed();rendererMode.value='webgl'
  } catch {rendererMode.value='still'}
}
onMounted(()=>{
  canvas.value?.addEventListener('webglcontextlost',lost)
  canvas.value?.addEventListener('webglcontextrestored',create)
  void create()
})
watch(()=>[props.progress,props.active,props.reduced,props.pointerX,props.pointerY],feed)
onBeforeUnmount(()=>{
  stopped=true;canvas.value?.removeEventListener('webglcontextlost',lost)
  canvas.value?.removeEventListener('webglcontextrestored',create)
  engine?.dispose();engine=null
})
</script>

<template>
  <div class="journey-world" :style="{opacity: alpha}" :data-world="room" :data-renderer="rendererMode" aria-hidden="true">
    <template v-if="rendererMode === 'still' && alpha > 0">
      <picture v-for="poster in posterLayers" :key="poster.room" class="journey-poster"
        :style="{opacity:poster.opacity, transform:`scale(${poster.scale})`}">
        <source media="(max-aspect-ratio: 3/4)" :srcset="`/assets/home/journey/${poster.room}-mobile.webp`" />
        <img :src="`/assets/home/journey/${poster.room}-wide.webp`" alt="" />
      </picture>
    </template>
    <canvas ref="canvas"></canvas>
  </div>
</template>

<style scoped>
.journey-world { position:absolute; inset:0; pointer-events:none; overflow:hidden;
  background-color:#0a0f14; background-image:radial-gradient(ellipse at 74% 38%,#1c3e35,transparent 54%),url('/assets/home/z30-signal-field.webp');
  background-size:cover; background-position:center; }
.journey-world[data-world=archive] {background-image:radial-gradient(at 68% 48%,#412c4d,transparent 58%),url('/assets/home/z30-signal-field.webp')}
.journey-world[data-world=conduit] {background-image:radial-gradient(at 68% 48%,#1f5149,transparent 58%),url('/assets/home/z30-signal-field.webp')}
.journey-world[data-world=observatory] {background-image:radial-gradient(at 68% 48%,#353244,transparent 55%),url('/assets/home/z30-signal-field.webp')}
.journey-poster,.journey-poster img { position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover; }
.journey-world canvas { display:block; width:100%; height:100%; visibility:hidden; }
.journey-world[data-renderer=webgl] canvas {visibility:visible;}
@media (forced-colors:active) {.journey-world {display:none}}
</style>
