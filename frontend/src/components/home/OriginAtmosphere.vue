<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ progress: number; active: boolean; reduced: boolean }>()
const canvas = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let w = 0, h = 0, raf = 0, last = 0, time = 0, blank = true, observer: ResizeObserver | undefined
let seed = 0x300929
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const colours = ['#75c2d1','#a2ffdc','#c4d798','#e89e60','#dc7985','#ae88c6','#7d9be1','#83c7cb']
const grains = Array.from({ length: 520 }, (_, i) => ({
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
    if(wakes.length>14)wakes.shift()
  }
  prevX=x; prevY=y; prevT=now
}
defineExpose({ disturb })
/** Spatially separated light guides. Only short portions meet the lamp at
 * a specular angle. The word itself has no backplate or enclosing silhouette. */
function guides(c:CanvasRenderingContext2D,p:number) {
  const fade=1-Math.min(1,p/.135)
  if(fade<=0)return
  const n=36, spread=Math.min(w*.146,h*.24)
  for(const side of [-1,1]){
    let x0=0,y0=0
    for(let i=0;i<=n;i++){
      const u=i/n
      const a=u*4.7+Math.sin(time*.16)*.12
      const x=w*.5+side*spread*Math.cos(a)*(.95-.26*u)+.034*h*Math.sin(u*5.4)
      const y=h*(.547+u*.68+p*.38)
      if(i){
        const lamp=Math.pow(Math.max(0,Math.cos(a*1.85+side*.88+time*.53)),12)
        const soft=Math.max(0,Math.sin(u*Math.PI))**.55
        const warm=.5+.5*Math.sin(time*.62-.75+u*.85)
        c.lineWidth=Math.max(.55,(1.05+1.7*lamp)*h/830)
        c.globalAlpha=fade*soft*(.13+.72*lamp)
        c.strokeStyle=`rgb(${Math.round(91+120*warm+28*lamp)},${Math.round(161+40*lamp-23*warm)},${Math.round(181+43*lamp-77*warm)})`
        c.beginPath();c.moveTo(x0,y0);c.lineTo(x,y);c.stroke()
      }
      x0=x;y0=y
    }
  }
}
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
  guides(c,p)
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
    c.globalAlpha=strength*g.light*(.19+1.06*lamp*lamp)*Math.min(1,(depth-.16)*2.2)
    c.drawImage(sprites[Math.floor(hue)],x-sz,y-sz,sz*2,sz*2)
  }
  for(let i=wakes.length-1;i>=0;i--){
    const q=wakes[i];q.life-=dt;if(q.life<=0){wakes.splice(i,1);continue}
    const fade=q.life/.58, flow=1-fade
    const x=q.x+q.dx*flow*.7, y=q.y+q.dy*flow*.7
    c.globalAlpha=fade*strength*.57;c.strokeStyle='#b4e7de';c.lineWidth=.8
    c.beginPath();c.moveTo(x+q.dx*.28,y+q.dy*.28)
    c.quadraticCurveTo(x-q.dx*.6+q.bend,y-q.dy*.6-q.bend,x-q.dx*(1.4+flow),y-q.dy*(1.4+flow));c.stroke()
    c.globalAlpha=fade*.26*strength;c.strokeStyle='#788fd9';c.beginPath();c.moveTo(x,y+2)
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
  <div v-show="progress < .125" class="origin-prism-light" aria-hidden="true" :class="{ 'is-paused': !active || reduced }"
    :style="{ opacity: Math.max(0,1-progress/.125) }"><i></i><b></b></div>
  <canvas ref="canvas" class="origin-air" aria-hidden="true"></canvas>
</template>
<style scoped>
.origin-prism-light {
  position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;
  -webkit-mask:url('/assets/home/z30-caustic-mask.webp') 50% 68% / cover no-repeat;
  mask:url('/assets/home/z30-caustic-mask.webp') 50% 68% / cover no-repeat;
}
.origin-prism-light i,.origin-prism-light b {
  position:absolute;inset:-42%;
  background:linear-gradient(107deg,transparent 24%,#87d1fcbb 38%,#beffcb 46%,transparent 57%);
  animation:origin-scan 8s ease-in-out infinite alternate;
}
.origin-prism-light b {background:linear-gradient(131deg,transparent 38%,#ff906bc9 51%,#eaa5e09c 54%,transparent 64%);
  animation:origin-scan 11s -6s ease-in-out infinite alternate-reverse;}
.origin-prism-light.is-paused :is(i,b){animation-play-state:paused}
@keyframes origin-scan {from{transform:translate3d(-23%,-3%,0)}to{transform:translate3d(26%,4%,0)}}
.origin-air { position:absolute;z-index:4;inset:0;width:100%;height:100%;pointer-events:none; }
@media(forced-colors:active){.origin-air,.origin-prism-light{display:none}}
</style>
