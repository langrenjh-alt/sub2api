import * as T from 'three'
import { clock, dustMaterial, skyMaterial } from './worldMaterials'
import { worldForms } from './worldForms'

type Key=[number,number,number,number,number,number,number]
/** Absolute camera and look-at keys. Between keys the lens follows a C1 spline,
 * not a stack of dissolve-only scenes. Each room occupies different world space. */
const keys: Key[] = [
  [0,0,.2,18,0,.2,4], [.08,.05,.28,13,.3,.2,-1],
  [.17,-.85,-.25,4,.35,.0,-10], [.25,-1.65,.95,-7,-.52,.1,-22],
  [.32,-3.48,1.55,-23,-.12,.4,-38],
  [.39,-3.25,.74,-33.0,.36,.52,-43], [.47,.53,.48,-34.4,.36,.58,-43],
  [.54,6.80,1.46,-36.6,.72,.64,-43], [.59,5.58,1.15,-46.8,1.02,.58,-60],
  [.65,3.14,.51,-53.2,.45,.48,-65], [.72,.1,.52,-56.1,.21,.32,-64],
  [.78,-2.72,1.2,-66.1,.16,.15,-78.3], [.83,-3.04,.92,-75.4,-.20,.15,-91],
  [.90,-1.9,.43,-82.05,-.71,.04,-93], [.96,.34,1.45,-83.1,-.65,.08,-93],
  [1,3.1,1.12,-83.6,-.48,.07,-93],
]
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const ease=(a:number,b:number,x:number)=>T.MathUtils.smoothstep(x,a,b)

export interface WorldInput { progress:number; active:boolean; reduced:boolean; pointerX:number; pointerY:number }
export interface JourneyRenderer { update(input:WorldInput):void;dispose():void }

export function createJourneyRenderer(canvas:HTMLCanvasElement):JourneyRenderer {
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(54,1,.15,87)
  const time=clock(),phase=clock(),pixel=clock(),height=clock()
  const sky=new T.Mesh(new T.PlaneGeometry(2,2),skyMaterial(phase))
  sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky)
  const step=worldForms(scene,dustMaterial(time,pixel,height))
  const path=new T.CatmullRomCurve3(keys.map(k=>new T.Vector3(k[1],k[2],k[3])))
  const focus=new T.CatmullRomCurve3(keys.map(k=>new T.Vector3(k[4],k[5],k[6])))
  const eye=new T.Vector3(),gaze=new T.Vector3()
  let input:WorldInput={progress:0,active:false,reduced:false,pointerX:0,pointerY:0}
  let frame=0,last=0,ended=false,w=0,h=0,inView=true,need=true
  const resize=()=>{
    w=canvas.clientWidth;h=canvas.clientHeight
    if(!w||!h)return
    pixel.value=Math.min(devicePixelRatio || 1,w<760?1.10:1.33)
    height.value=h;renderer.setPixelRatio(pixel.value);renderer.setSize(w,h,false)
    camera.aspect=w/h;need=true;schedule()
  }
  const segment=(p:number)=>{
    let i=0
    while(i<keys.length-2&&keys[i+1][0]<p)i++
    return (i+(p-keys[i][0])/(keys[i+1][0]-keys[i][0]))/(keys.length-1)
  }
  let lookX=0,lookY=0
  function draw(dt:number) {
    // Reduced motion keeps chapter landmarks, without continuous travel or drift.
    const raw=clamp(input.progress||0,0,1)
    const p=input.reduced ? raw<.09?0:raw<.33?.235:raw<.565?.445:raw<.79?.68:.94 : raw
    phase.value=p
    if(input.active&&!input.reduced)time.value+=dt
    const narrow=1-ease(.72,1.14,camera.aspect),t=segment(p)
    path.getPoint(t,eye);focus.getPoint(t,gaze)
    // Preserve the upper-middle composition on portrait screens while keeping
    // the gallery, instrument and observatory right of the desktop annotation.
    const rooms=ease(.31,.39,p),mode=narrow*rooms
    gaze.x+=2.50*mode
    gaze.y-=1.38*mode
    eye.z+=2.45*mode
    eye.y+=.36*mode
    const k=1-Math.exp(-Math.max(.035,dt)*5.0)
    lookX+=((input.reduced?0:clamp(input.pointerX,-1,1))-lookX)*k
    lookY+=((input.reduced?0:clamp(input.pointerY,-1,1))-lookY)*k
    eye.x+=lookX*.40;eye.y-=lookY*.26
    camera.position.copy(eye);camera.up.set(.035*Math.sin(p*17)*(1-narrow),1,0)
    camera.lookAt(gaze);camera.fov=52+8*ease(.06,.24,p)*(1-ease(.28,.39,p))+narrow*8
    camera.updateProjectionMatrix()
    step(time.value,p);renderer.render(scene,camera)
  }
  function schedule(){
    if(!ended&&!document.hidden&&inView&&!frame)frame=requestAnimationFrame(tick)
  }
  function tick(now:number) {
    frame=0
    if(ended||!w||!h||document.hidden||!inView)return
    const running=input.active&&!input.reduced&&input.progress>.005
    const budget=w<760?1000/30:1000/40
    if(need||now-last>=budget){
      const dt=last?Math.min(.075,(now-last)/1000):0
      last=now;need=false;draw(Math.max(0,dt))
    }
    if(running)schedule()
  }
  function visibility(){
    if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0}
    else{need=true;schedule()}
  }
  const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize)
  const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
    inView=entries[0]?.isIntersecting??true
    if(inView){need=true;last=0;schedule()}
    else {cancelAnimationFrame(frame);frame=0;last=0}
  })
  ro?.observe(canvas);io?.observe(canvas)
  if(!ro)window.addEventListener('resize',resize)
  document.addEventListener('visibilitychange',visibility)
  resize()
  return {
    update(v){input=v;need=true;schedule()},
    dispose(){
      ended=true;cancelAnimationFrame(frame);ro?.disconnect();io?.disconnect()
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize)
      const materials=new Set<T.Material>(),geometry=new Set<T.BufferGeometry>()
      scene.traverse(obj=>{
        const m=obj as T.Mesh
        if(m.geometry)geometry.add(m.geometry)
        if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat)
        if(obj instanceof T.InstancedMesh)obj.dispose()
      })
      geometry.forEach(x=>x.dispose());materials.forEach(x=>x.dispose())
      renderer.dispose()
    },
  }
}
