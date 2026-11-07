<script setup lang="ts">
import { computed } from 'vue'
import { phase } from './journey/path'

const props=defineProps<{progress:number;x:number;y:number;active:boolean;reduced:boolean}>()
const framing=computed(()=>{
  const t=props.reduced?0:phase(0,.17,props.progress)
  const x=props.reduced?0:props.x, y=props.reduced?0:props.y
  const aperture=phase(.015,.136,props.progress)
  return {
    '--far':`translate3d(${x*-.38-t*2.4}%,${y*-.42-t*1.8}%,0) scale(${1.022+t*.13})`,
    '--near':`translate3d(${x*1.28+t*6.1}%,${y*.93-t*2.4}%,0) scale(${1.032+t*.23}) rotate(${x*.18+t*1.32}deg)`,
    maskImage:!props.reduced && aperture>0
      ? `radial-gradient(ellipse farthest-corner at 50% 46%,transparent ${Math.max(0,aperture*130-22)}%,#000 ${aperture*130}%)` : 'none',
  }
})
</script>
<template>
  <!-- Two depths of the same original photographic plate. They meet in its dark
       optical channel, never along a visible vertical seam. The base image is
       also the source traced by the independent, extruded glass wordmark. -->
  <div v-show="progress < (reduced ? .09 : .137)" class="atelier-frame" aria-hidden="true" :style="framing" :class="{'is-resting':!active}">
    <picture class="plate-far">
      <source media="(max-aspect-ratio: 7/8)" srcset="/assets/home/atelier-portrait.webp" />
      <img class="signal-plate" src="/assets/home/atelier-landscape.webp" alt="" fetchpriority="high" />
    </picture>
    <div v-if="!reduced" class="plate-left-light"><div class="plate-spec"><i></i></div></div>
    <div v-show="!reduced && progress<.18" class="plate-depth">
      <div class="plate-near">
        <picture>
          <source media="(max-aspect-ratio: 7/8)" srcset="/assets/home/atelier-portrait.webp" />
          <img src="/assets/home/atelier-landscape.webp" alt="" />
        </picture>
        <div class="plate-spec" :class="{'is-paused':!active}"><i></i></div>
      </div>
    </div>
    <div class="plate-proof"></div>
  </div>
</template>
<style scoped>
.atelier-frame {position:absolute;z-index:1;inset:0;overflow:hidden;pointer-events:none;background:#0b0e10;}
.atelier-frame :is(picture,.plate-near,.plate-depth,.plate-spec,.plate-proof) {position:absolute;inset:0;display:block;}
.atelier-frame img{width:100%;height:100%;display:block;object-fit:cover;object-position:50% 50%;}
.plate-far{transform:var(--far);}
.plate-left-light{position:absolute;inset:0;transform:var(--far);mask:linear-gradient(90deg,#000 15%,transparent 60%);}
.plate-left-light .plate-spec{opacity:.4;}
.plate-left-light .plate-spec i{animation-duration:13s;animation-direction:alternate-reverse;}
.plate-depth{mask-image:linear-gradient(102deg,transparent 26%,#000 59%); }
.plate-near{transform:var(--near);transform-origin:55% 50%;}
.plate-near > picture,.plate-near .plate-spec{animation:breathing-depth 14s ease-in-out infinite alternate;}
.plate-spec{
  mask:url('/assets/home/atelier-light-landscape.webp') center / cover;
  opacity:.57;mix-blend-mode:screen;
}
.plate-spec i{position:absolute;inset:-20%;background:linear-gradient(116deg,transparent 27%,#9dc7d977 43%,#fff4c7ad 48%,transparent 56%);animation:caustic 9s cubic-bezier(.42,0,.54,1) infinite alternate;}
.atelier-frame.is-resting :is(.plate-near > picture,.plate-spec,.plate-spec i){animation-play-state:paused;}
.plate-proof{background:linear-gradient(90deg,#070a0b2b 0%,transparent 46%),linear-gradient(0deg,#06080a9c 0%,transparent 22%);}
@keyframes caustic{from{transform:translate3d(-26%,0,0)}to{transform:translate3d(22%,-2%,0)}}
@keyframes breathing-depth{from{translate:0 0}to{translate:.55% -.39%}}
@media(max-aspect-ratio:7/8){
  .plate-spec{mask-image:url('/assets/home/atelier-light-portrait.webp')}
  .plate-proof{background:radial-gradient(ellipse 90% 23% at 25% 81%,#080a0c88,transparent),linear-gradient(0deg,#06080a99,transparent 19%);}
}
@media(forced-colors:active){.plate-spec{display:none}}
</style>
