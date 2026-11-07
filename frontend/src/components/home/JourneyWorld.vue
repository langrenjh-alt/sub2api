<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { JourneyRenderer, WorldInput } from './journey/worldScene'

const props=defineProps<WorldInput>()
const emit=defineEmits<{mode:[value:'pending'|'webgl'|'still']}>()
const canvas=ref<HTMLCanvasElement>()
const rendererMode=ref<'pending' | 'webgl' | 'still'>('pending')
const mode=(value:'pending'|'webgl'|'still')=>{rendererMode.value=value;emit('mode',value)}
const room=computed(()=>props.progress<.33?'estuary':props.progress<.565?'archive':props.progress<.79?'conduit':'observatory')
const alpha=computed(()=>rendererMode.value==='webgl'?1:Math.min(1,Math.max(0,(props.progress-.014)/.104)))
// Additional handoff photographs preserve the winding relay and reflective
// waterline in browsers without a GPU; static CSS gallery panels stay separate.
const plates=[
  {id:'estuary',start:0,pose:.23}, {id:'archive',start:.32,pose:.445},
  {id:'transfer',start:.545,pose:.595},{id:'conduit',start:.625,pose:.685},
  {id:'basin',start:.765,pose:.805},{id:'observatory',start:.862,pose:.94},
]
const posterLayers=computed(()=>{
  const p=props.progress
  if(props.reduced)return [{room:room.value,opacity:1,scale:1}]
  return plates.flatMap(({id,start:enter,pose},i)=>{
    const exit=plates[i+1]?.start??1.10
    const fade=(x:number)=>{const a=Math.min(1,Math.max(0,x));return a*a*(3-2*a)}
    const opacity=i===0?1:fade((p-enter+.034)/.068)
    // Only the incoming photograph fades; its predecessor stays fully
    // opaque underneath, so the GPU-free dissolve never dips to black.
    if(p < enter-.034 || p >= exit+.034 || opacity===0)return []
    return [{room:id,opacity,scale:Math.max(1,1.055+(p-pose)*.28)}]
  })
})
let engine:JourneyRenderer|null=null
let stopped=false, generation=0
const feed=()=>engine?.update({progress:props.progress,active:props.active,reduced:props.reduced,pointerX:props.pointerX,pointerY:props.pointerY})
function lost(event:Event){event.preventDefault();generation++;engine?.dispose();engine=null;mode('still')}
async function create(){
  if(stopped||!canvas.value||engine)return
  const ticket=++generation
  if(typeof WebGL2RenderingContext==='undefined'||window.matchMedia('(forced-colors: active)').matches){
    mode('still');return
  }
  try {
    const { createJourneyRenderer }=await import('./journey/worldScene')
    if(stopped||generation!==ticket||!canvas.value)return
    engine=createJourneyRenderer(canvas.value,()=>{if(!stopped&&ticket===generation)mode('webgl')})
    feed()
  } catch {if(!stopped&&ticket===generation)mode('still')}
}
onMounted(()=>{
  canvas.value?.addEventListener('webglcontextlost',lost)
  canvas.value?.addEventListener('webglcontextrestored',create)
  void create()
})
watch(()=>[props.progress,props.active,props.reduced,props.pointerX,props.pointerY],feed)
onBeforeUnmount(()=>{
  stopped=true;generation++;canvas.value?.removeEventListener('webglcontextlost',lost)
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
.journey-world {position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:#090d10;}
.journey-poster,.journey-poster img { position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover; }
.journey-world canvas { display:block; width:100%; height:100%; visibility:hidden; }
.journey-world[data-renderer=webgl] canvas {visibility:visible;}
@media (forced-colors:active) {.journey-world {display:none}}
</style>
