<script setup lang="ts">
// Poster for browsers without WebGL only. Never loaded in the real optical path.
defineProps<{progress:number}>()
const portrait='/assets/home/atelier-portrait.webp', landscape='/assets/home/atelier-landscape.webp'
</script>
<template>
  <picture class="fallback-plate" aria-hidden="true" :style="{opacity:Math.max(0,1-progress/.12)}">
    <source media="(max-aspect-ratio: 7/8)" :srcset="portrait" />
    <img class="signal-plate" :src="landscape" alt="" />
  </picture>
</template>
<style scoped>
.fallback-plate{position:absolute;z-index:1;inset:0;pointer-events:none;display:block;}
.fallback-plate img{width:100%;height:100%;display:block;object-fit:cover;}
</style>
