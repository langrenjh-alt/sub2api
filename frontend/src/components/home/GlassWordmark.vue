<script setup lang="ts">
/** Accessible page title. Only the shared world draws the live letters. */
defineProps<{mode:'pending'|'still'|'webgl';progress:number}>()
</script>
<template>
  <h1 id="z30-title" :class="mode==='webgl'||progress>=.14 ? 'sr-only' : 'static-word'"
    :data-renderer="mode==='webgl'?'webgl':'svg'">
    <span v-if="mode==='webgl'">Z30</span>
    <img v-else src="/z30-emblem.svg" width="224" height="92" alt="Z30" />
  </h1>
</template>
<style scoped>
.static-word {position:absolute;z-index:2;left:50%;top:47%;transform:translate(-50%,-50%);
  margin:0;width:clamp(200px,min(36vw,75svh),650px);pointer-events:none;}
.static-word img {width:100%;height:auto;display:block;}
@media(max-width:780px){.static-word{top:45%;width:clamp(175px,61vw,320px)}}
</style>
