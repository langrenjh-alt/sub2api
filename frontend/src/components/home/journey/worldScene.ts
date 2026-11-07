import * as T from 'three'
import { clock, dustMaterial, skyMaterial, opticalStudio, lightStudio, linkStudio, QUARTZ_LAYER, WATER_LAYER } from './worldMaterials'
import { PixelBudget } from './worldBudget'
import { createGalleryOptics } from './galleryOptics'
import { worldForms } from './worldForms'

type Key=[number,number,number,number,number,number,number]
/** Absolute camera and look-at keys. Between keys the lens follows a C1 spline,
 * not a stack of dissolve-only scenes. Each room occupies different world space. */
const keys: Key[] = [
  [0,0,.2,18,0,.2,4], [.08,.05,.28,13,.3,.2,-1],
  [.17,-.85,-.25,4,.35,.0,-10], [.25,-1.65,.95,-7,-.52,.1,-22],
  [.32,-3.48,1.55,-23,-.12,.4,-38],
  [.39,-3.25,.74,-33.0,.36,.52,-43], [.47,.53,.48,-34.4,.36,.58,-43],
  [.54,6.80,1.46,-36.6,1.29,.18,-44.2], [.57,6.95,1.16,-41.3,2.41,-.44,-50.8],
  [.605,5.22,.85,-48.4,2.44,-.38,-58.2],
  [.65,3.14,.51,-53.2,.45,.48,-65], [.72,.1,.52,-56.1,.21,.32,-64],
  [.78,-2.72,1.2,-66.1,.16,.15,-78.3], [.83,-3.04,.92,-75.4,-.20,.15,-91],
  [.90,-1.90,1.19,-80.6,-.76,-.61,-93], [.96,.34,1.70,-81.25,-.69,-.83,-93],
  [1,3.1,1.51,-81.7,-.60,-.75,-93],
]
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const ease=(a:number,b:number,x:number)=>T.MathUtils.smoothstep(x,a,b)

export interface WorldInput { progress:number; active:boolean; reduced:boolean; pointerX:number; pointerY:number }
export interface JourneyRenderer { update(input:WorldInput):void;dispose():void }

export function createJourneyRenderer(canvas:HTMLCanvasElement,onVeil?:(bitmap:HTMLCanvasElement)=>void):JourneyRenderer {
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(54,1,.15,87)
  const time=clock(),phase=clock(),pixel=clock(),height=clock(),studio=opticalStudio()
  const sky=new T.Mesh(new T.PlaneGeometry(2,2),skyMaterial(phase))
  sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky)
  const step=worldForms(scene,dustMaterial(time,pixel,height))
  linkStudio(scene,studio)
  // One reusable opaque-scene texture for every dielectric AND the works panels.
  // The inexpensive virtual-camera reflection runs only near the observatory.
  const target=()=>new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,generateMipmaps:false})
  const transmission=target(),reflection=target(),mirror=new T.PerspectiveCamera(),reflectAim=new T.Vector3()
  studio.uTransmission.value=transmission.texture;studio.uReflection.value=reflection.texture
  const gallery=createGalleryOptics(scene,canvas);gallery.setRefraction(transmission.texture)
  const path=new T.CatmullRomCurve3(keys.map(k=>new T.Vector3(k[1],k[2],k[3])))
  const focus=new T.CatmullRomCurve3(keys.map(k=>new T.Vector3(k[4],k[5],k[6])))
  const eye=new T.Vector3(),gaze=new T.Vector3()
  const budget=new PixelBudget()
  let input:WorldInput={progress:0,active:false,reduced:false,pointerX:0,pointerY:0}
  let frame=0,last=0,ended=false,w=0,h=0,inView=true,need=true,lastMirror=-1,mirrorP=-1
  let armForward=true,armReverse=false,oldProgress=NaN
  const dimensions=()=>{
    pixel.value=Math.min(devicePixelRatio || 1,w<760?1.18:1.40)*budget.scale
    renderer.setPixelRatio(pixel.value);renderer.setSize(w,h,false)
    renderer.getDrawingBufferSize(studio.uFrame.value)
    const {x,y}=studio.uFrame.value
    transmission.setSize(Math.max(1,Math.round(x*.55)),Math.max(1,Math.round(y*.55)))
    reflection.setSize(Math.max(1,Math.round(x*.40)),Math.max(1,Math.round(y*.40)))
    lastMirror=-1
  }
  const resize=()=>{
    w=canvas.clientWidth;h=canvas.clientHeight
    if(!w||!h)return
    height.value=h;dimensions();budget.reset()
    camera.aspect=w/h;need=true;schedule()
  }
  const segment=(p:number)=>{
    let i=0
    while(i<keys.length-2&&keys[i+1][0]<p)i++
    return (i+(p-keys[i][0])/(keys[i+1][0]-keys[i][0]))/(keys.length-1)
  }
  // Three's ordinary CatmullRom is C1 in knot index, but chapter progress
  // keys are not uniformly spaced. A monotone cubic map keeps dolly velocity
  // continuous at their boundaries, including the gallery-to-conduit turn.
  const slopes=keys.map((k,i)=>{
    if(i===0)return 1/(keys[1][0]-k[0])
    if(i===keys.length-1)return 1/(k[0]-keys[i-1][0])
    return 2/(keys[i+1][0]-keys[i-1][0])
  })
  const drive=(p:number)=>{
    const raw=segment(p)*(keys.length-1),i=Math.min(keys.length-2,Math.floor(raw))
    const u=raw-i,dt=keys[i+1][0]-keys[i][0],u2=u*u,u3=u2*u
    return (i+3*u2-2*u3+dt*(slopes[i]*(u3-2*u2+u)+slopes[i+1]*(u3-u2)))/(keys.length-1)
  }
  function mirrorPass(p:number){
    const y=-3.24
    mirror.copy(camera,false)
    mirror.position.y=2*y-camera.position.y;mirror.up.copy(camera.up);mirror.up.y*=-1
    reflectAim.copy(gaze);reflectAim.y=2*y-gaze.y;mirror.lookAt(reflectAim)
    mirror.updateMatrixWorld()
    studio.uReflectionVP.value.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse)
    mirror.layers.set(0)
    renderer.setRenderTarget(reflection);renderer.render(scene,mirror)
    lastMirror=time.value;mirrorP=p
  }
  function captureVeil(p:number){
    if(onVeil&&!input.reduced&&p>=.10&&p<=.18&&Math.abs(oldProgress-p)<.10){
      const way=oldProgress<.13&&p>=.13?1:oldProgress>.13&&p<=.13?-1:0
      if((way===1&&armForward)||(way===-1&&armReverse)){
        const ratio=Math.min(1,900/canvas.width,560/canvas.height)
        const copy=document.createElement('canvas')
        copy.width=Math.max(1,Math.round(canvas.width*ratio));copy.height=Math.max(1,Math.round(canvas.height*ratio))
        const ctx=copy.getContext('2d')
        if(ctx){ctx.drawImage(canvas,0,0,copy.width,copy.height);onVeil(copy);if(way===1)armForward=false;else armReverse=false}
      }
    }
    if(p<=.11){armForward=true;armReverse=false}
    if(p>=.155){armReverse=true;armForward=false}
    oldProgress=p
  }
  function draw(dt:number) {
    // Reduced motion keeps chapter landmarks, without continuous travel or drift.
    const raw=clamp(input.progress||0,0,1)
    const p=input.reduced ? raw<.09?0:raw<.33?.235:raw<.565?.445:raw<.79?.68:.94 : raw
    phase.value=p
    if(input.active&&!input.reduced)time.value+=dt
    const narrow=1-ease(.72,1.14,camera.aspect),t=drive(p)
    path.getPoint(t,eye);focus.getPoint(t,gaze)
    // Preserve the upper-middle composition on portrait screens while keeping
    // the gallery, instrument and observatory right of the desktop annotation.
    const rooms=ease(.31,.39,p),mode=narrow*rooms
    gaze.x+=2.50*mode
    gaze.y-=1.38*mode
    eye.z+=2.45*mode
    eye.y+=.36*mode
    if(!input.reduced){
      eye.x+=clamp(input.pointerX,-1,1)*.34;eye.y-=clamp(input.pointerY,-1,1)*.22
    }
    camera.position.copy(eye);camera.up.set(.035*Math.sin(p*17)*(1-narrow),1,0)
    camera.lookAt(gaze);camera.fov=52+8*ease(.06,.24,p)*(1-ease(.28,.39,p))+narrow*8
    camera.updateProjectionMatrix()
    lightStudio(studio,time.value,p);step(time.value,p)
    camera.updateMatrixWorld()
    gallery.update(camera,p,time.value,input.reduced,raw)
    if(p>.695 && (lastMirror<0||time.value-lastMirror>.040||Math.abs(mirrorP-p)>.0001||need))mirrorPass(p)
    if(p>.012){
      camera.layers.set(0);camera.layers.enable(WATER_LAYER)
      renderer.setRenderTarget(transmission);renderer.render(scene,camera)
    }
    camera.layers.set(0);camera.layers.enable(QUARTZ_LAYER);camera.layers.enable(WATER_LAYER)
    renderer.setRenderTarget(null);renderer.render(scene,camera)
    captureVeil(p)
  }
  function schedule(){
    if(!ended&&!document.hidden&&inView&&!frame)frame=requestAnimationFrame(tick)
  }
  function tick(now:number) {
    frame=0
    if(ended||!w||!h||document.hidden||!inView)return
    const running=input.active&&!input.reduced&&input.progress>.005
    if(need||running){
      const observed=last ? now-last : 0
      if(running&&last>0&&budget.sample(observed))dimensions()
      const dt=Math.min(.08,Math.max(0,observed)/1000)
      last=running?now:0;draw(dt);need=false
    }
    if(running)schedule()
  }
  function visibility(){
    if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;budget.reset()}
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
  const plate=new T.TextureLoader().load('/assets/home/atelier-interference.webp',()=>{
    if(ended)return
    studio.uPlateReady.value=1;need=true;schedule()
  })
  studio.uAtelierPlate.value=plate
  resize()

  // Prime both material variants while the user is at the opening plate.
  // compile() schedules GPU program creation and visits nonvisible geometry;
  // it doesn't render or change the visible scene.
  const primePrograms=()=>{
    if(ended || document.hidden || input.reduced || input.progress>.09) return
    const prev=renderer.getRenderTarget()
    try {
      renderer.compile(scene,camera)
      renderer.setRenderTarget(transmission)
      renderer.compile(scene,camera)
    } finally {
      renderer.setRenderTarget(prev)
    }
  }
  const warmId=window.setTimeout(primePrograms,80)
  return {
    update(v){input=v;need=true;schedule()},
    dispose(){
      ended=true;window.clearTimeout(warmId);cancelAnimationFrame(frame);ro?.disconnect();io?.disconnect()
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize)
      gallery.dispose()
      const materials=new Set<T.Material>(),geometry=new Set<T.BufferGeometry>()
      scene.traverse(obj=>{
        const m=obj as T.Mesh
        if(m.geometry)geometry.add(m.geometry)
        if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat)
        if(obj instanceof T.InstancedMesh)obj.dispose()
      })
      geometry.forEach(x=>x.dispose());materials.forEach(x=>x.dispose())
      plate.dispose();transmission.dispose();reflection.dispose();renderer.dispose()
    },
  }
}
