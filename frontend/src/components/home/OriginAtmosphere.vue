<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ progress: number; active: boolean; reduced: boolean }>()
const canvas = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let w = 0, h = 0, raf = 0, last = 0, time = 0, blank = true, observer: ResizeObserver | undefined
let seed = 0x300929
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const colours = ['#bed5df','#e5e2da','#ced6c8','#c59a72','#d5b59a','#a4b6c3','#91a5bb','#a9b6b7']
const grains = Array.from({ length: 260 }, (_, i) => ({
  t: random(), z: .7 + 1.9 * random(), a: random() * 6.28,
  r: .12 + random() ** 2, sz: .42 + random() ** 3 * 1.75,
  phase: random() * 6.28, light: .14 + random() ** 2 * .75, bank: i % 3 === 0 ? -1 : 1,
}))
const sprites: HTMLCanvasElement[] = []
function makeSprites() {
  for (const colour of colours) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32
    const g = c.getContext('2d'); if (!g) return
    const radial = g.createRadialGradient(14, 12, .25, 16, 16, 15)
    radial.addColorStop(0, '#f4fffbdc'); radial.addColorStop(.10, colour + 'f5')
    radial.addColorStop(.28, colour + '7e'); radial.addColorStop(.53, colour + '24')
    radial.addColorStop(1, colour + '00'); g.fillStyle = radial; g.fillRect(0, 0, 32, 32); sprites.push(c)
  }
}
type Wake = { x:number; y:number; dx:number; dy:number; life:number; bend:number }
const wakes: Wake[] = []
let prevX = 0, prevY = 0, prevT = 0
function disturb(nx: number, ny: number, now: number) {
  const x = (nx + 1) * .5 * w, y = (ny + 1) * .5 * h
  const dt = now - prevT, dx = x - prevX, dy = y - prevY
  if (props.active && !props.reduced && props.progress < .18 && dt > 0 && dt < 140 && dx*dx+dy*dy > 36) {
    const len = Math.hypot(dx,dy), k = Math.min(1, 100/len)
    wakes.push({ x, y, dx:dx*k, dy:dy*k, life:.58, bend:(random()-.5)*13 })
    if(wakes.length>6)wakes.shift()
  }
  prevX=x; prevY=y; prevT=now
}
defineExpose({ disturb })
function draw(dt: number) {
  if (!ctx || !w || !h || !sprites.length) return
  const c=ctx, p=props.progress
  if(p >= .20 && blank)return
  c.clearRect(0,0,w,h)
  blank = p >= .20
  if(blank) return
  const travel = props.reduced ? 0 : p * 4.9
  const strength = (1-Math.min(1,Math.max(0,(p-.14)/.06)))
  c.globalCompositeOperation = 'lighter'
  // Dust is visible in incident light, not an evenly illuminated star field.
  for(let i=0;i<grains.length;i++){
    const g=grains[i], depth=g.z-travel
    if(depth<.16)continue
    const t=g.t, a=g.a+time*.055+p*.8
    const spread=g.bank===1 ? .14+.38*t : .25+.46*t
    // Two converging currents pass through the focal plane instead of sliding a wallpaper.
    const wx=g.bank*(.095+t*.69) + Math.sin(a+t*9)*g.r*spread + .12*Math.sin(t*7+time*.08)
    const wy=-.10+t*1.27 + g.r*spread*Math.cos(a+t*9)*1.10
    const x=w*.5+wx*h/depth, y=h*.495+wy*h/depth-h*.46*p
    if(x< -18 || x>w+18 || y< -18 || y>h+18)continue
    const lamp=Math.sin(t*7.3+time*.81+g.phase*.24)*.5+.5
    const hue=(g.bank*.57+t*1.12+time*.38+(1-lamp)*1.8+8)%8
    const sz=Math.min(11,g.sz*(h/740)*4.6/depth)
    const beam=Math.exp(-((y/h-.83+(x/w-.5)*.48)**2)/.038)
    c.globalAlpha=strength*g.light*(.10+.75*lamp*lamp)*(.13+.87*beam)*Math.min(1,(depth-.16)*2.2)
    c.drawImage(sprites[Math.floor(hue)],x-sz,y-sz,sz*2,sz*2)
  }
  for(let i=wakes.length-1;i>=0;i--){
    const q=wakes[i];q.life-=dt;if(q.life<=0){wakes.splice(i,1);continue}
    const fade=q.life/.58, flow=1-fade
    const x=q.x+q.dx*flow*.7, y=q.y+q.dy*flow*.7
    c.globalAlpha=fade*strength*.32;c.strokeStyle='#b4e7de';c.lineWidth=.8
    c.beginPath();c.moveTo(x+q.dx*.28,y+q.dy*.28)
    c.quadraticCurveTo(x-q.dx*.6+q.bend,y-q.dy*.6-q.bend,x-q.dx*(1.4+flow),y-q.dy*(1.4+flow));c.stroke()
    c.globalAlpha=fade*.14*strength;c.strokeStyle='#788fd9';c.beginPath();c.moveTo(x,y+2)
    c.lineTo(x-q.dx*2,y-q.dy*2+q.bend*.5);c.stroke()
  }
  c.globalAlpha=1;c.globalCompositeOperation='source-over'
}
function frame(t:number) {
  raf=0
  const run=props.active && !props.reduced && props.progress < .20 && !document.hidden
  const dt=run && last ? Math.min(.08,(t-last)/1000):0
  time+=dt;last=run?t:0;draw(dt)
  if(run)schedule()
}
function schedule(){if(ctx && !raf && (props.progress < .20 || !blank))raf=requestAnimationFrame(frame)}
function resize(){
  if(!canvas.value || !ctx)return
  w=canvas.value.clientWidth;h=canvas.value.clientHeight
  // Subpixel haze is intentional; reserve high DPI for type and the glass mesh.
  const dpr=Math.min(devicePixelRatio || 1,1.15)
  canvas.value.width=Math.round(w*dpr);canvas.value.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);schedule()
}
onMounted(()=>{
  if (!canvas.value || !('CanvasRenderingContext2D' in window)) return
  ctx=canvas.value.getContext('2d'); if(!ctx)return
  makeSprites();resize()
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(canvas.value)}
  else window.addEventListener('resize',resize)
})
watch(()=>[props.progress,props.active,props.reduced],()=>{ if(!props.active)wakes.length=0;schedule() })
onBeforeUnmount(()=>{cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',resize);ctx=null;sprites.length=0})
</script>

<template>
  <canvas ref="canvas" class="origin-air" aria-hidden="true"></canvas>
</template>
<style scoped>
.origin-air { position:absolute;z-index:4;inset:0;width:100%;height:100%;pointer-events:none; }
@media(forced-colors:active){.origin-air{display:none}}
</style>
