import * as T from 'three'
import { clock, dustMaterial, skyMaterial, opticalStudio, lightStudio, linkStudio, QUARTZ_LAYER, WATER_LAYER } from './worldMaterials'
import { createChamberAir } from './chamberAir'
import { irisChapterStart, irisReadingPose } from './path'
import { createJourneyRail } from './cameraRail'
import { createLiveOpening } from './liveOpening'
import { makeLightGuide } from './lightGuide'
import { flightBlend, nearFlight } from './opticalFlight'
import { PixelBudget } from './worldBudget'
import { createGalleryOptics } from './galleryOptics'
import { worldForms } from './worldForms'

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const ease=(a:number,b:number,x:number)=>T.MathUtils.smoothstep(x,a,b)

export interface WorldInput { progress:number; active:boolean; reduced:boolean; pointerX:number; pointerY:number }
export interface JourneyRenderer { update(input:WorldInput):void;dispose():void }

export function createJourneyRenderer(canvas:HTMLCanvasElement,onFirstFrame?:()=>void):JourneyRenderer {
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(54,1,.15,87)
  const time=clock(),phase=clock(),pixel=clock(),height=clock(),studio=opticalStudio()
  const sky=new T.Mesh(new T.PlaneGeometry(2,2),skyMaterial(phase))
  sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky)
  const step=worldForms(scene,dustMaterial(time,pixel,height))
  const guide=makeLightGuide(scene)
  linkStudio(scene,studio)
  // One reusable opaque-scene texture for every dielectric AND the works panels.
  // The inexpensive virtual-camera reflection runs only near the observatory.
  const target=()=>new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,generateMipmaps:false})
  const transmission=target(),reflection=target(),mirror=new T.PerspectiveCamera(),reflectAim=new T.Vector3()
  studio.uTransmission.value=transmission.texture;studio.uReflection.value=reflection.texture
  const gallery=createGalleryOptics(scene,canvas);gallery.setRefraction(transmission.texture)
  const travel=createJourneyRail()
  const chamberAir=createChamberAir(scene)
  const opening=createLiveOpening(scene)
  opening.setField(transmission.texture,studio.uFrame.value)
  const eye=new T.Vector3(),gaze=new T.Vector3(),side=new T.Vector3()
  const budget=new PixelBudget()
  let input:WorldInput={progress:0,active:false,reduced:false,pointerX:0,pointerY:0}
  let frame=0,last=0,ended=false,w=0,h=0,inView=true,need=true,lastMirror=-1,mirrorP=-1
  let firstFrame=true
  const dimensions=()=>{
    // Keep the optical edges at CSS pixel density on a normal-size viewport.
    // Under sustained pressure shed supersampling first, not the whole scene.
    const cap=Math.min(1.65,Math.sqrt(4100000/Math.max(1,w*h)))
    pixel.value=Math.min(cap,Math.max(1,Math.min(devicePixelRatio || 1,cap)*budget.scale))
    renderer.setPixelRatio(pixel.value);renderer.setSize(w,h,false)
    renderer.getDrawingBufferSize(studio.uFrame.value)
    const {x,y}=studio.uFrame.value
    transmission.setSize(Math.max(1,Math.round(x)),Math.max(1,Math.round(y)))
    reflection.setSize(Math.max(1,Math.round(x*.63)),Math.max(1,Math.round(y*.63)))
    lastMirror=-1
  }
  const resize=()=>{
    w=canvas.clientWidth;h=canvas.clientHeight
    if(!w||!h)return
    height.value=h;dimensions();budget.reset()
    camera.aspect=w/h;need=true;schedule()
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
  function draw(dt:number) {
    // Reduced motion keeps chapter landmarks, without continuous travel or drift.
    const raw=clamp(input.progress||0,0,1)
    const p=input.reduced ? raw<.09?0:raw<.33?.235:raw<.565?.445:raw<irisChapterStart?.66:irisReadingPose : raw
    phase.value=p
    if(input.active&&!input.reduced)time.value+=dt
    const narrow=1-ease(.72,1.14,camera.aspect)
    travel(p,eye,gaze,true,camera.aspect)
    const tracking=flightBlend(p), macro=nearFlight(p)
    // Preserve the upper-middle composition on portrait screens while keeping
    // the gallery, instrument and observatory right of the desktop annotation.
    const rooms=ease(.31,.39,p),mode=narrow*rooms*(1-ease(.669,.716,p))
    gaze.x+=2.50*mode
    gaze.y-=1.38*mode
    eye.z+=2.45*mode
    eye.y+=.36*mode
    // Leave the left receiver and attached beam outside the copy at the
    // nearly square desktop sizes. The phone uses a stacked composition.
    const bench=ease(.55,.63,p)*(1-ease(.72,.80,p))
    gaze.x-=.39*(1-tracking)*bench*ease(.68,.91,camera.aspect)*(1-.52*ease(1.18,1.75,camera.aspect))
    const reveal=tracking*ease(.927,.973,p)
    if(reveal){
      // At the far side of the iris, put the readout in the negative space,
      // not over the receiving plate. The phone frames its text below.
      side.subVectors(gaze,eye).cross(camera.up).normalize()
      gaze.addScaledVector(side,-2.95*reveal*(1-narrow))
      gaze.y-=.96*reveal*narrow
    }
    if(!input.reduced){
      // Orbit the origin with a physical eye offset; taper sideways motion
      // before the camera reaches the narrow path beside the extruded word.
      const origin=1-ease(.025,.105,p)
      eye.x+=clamp(input.pointerX,-1,1)*(.34+.79*origin)*(1-.98*macro)
      eye.y-=clamp(input.pointerY,-1,1)*(.22+.39*origin)*(1-.98*macro)
    }
    camera.position.copy(eye);camera.up.set(.035*Math.sin(p*17)*(1-narrow),1,0)
    camera.lookAt(gaze);camera.fov=52+8*ease(.06,.24,p)*(1-ease(.28,.39,p))+narrow*8
    camera.near=.15-.133*macro;camera.fov+=7*macro;camera.updateProjectionMatrix()
    lightStudio(studio,time.value,p);step(time.value,p)
    camera.updateMatrixWorld()
    guide(p,studio.uFrame.value.y)
    chamberAir(time.value,p,studio.uFrame.value.y)
    opening.update(camera,p,time.value,input.reduced)
    gallery.update(camera,p,time.value,input.reduced,raw)
    if(p>.695 && (lastMirror<0||time.value-lastMirror>.040||Math.abs(mirrorP-p)>.0001||need))mirrorPass(p)
    if(opening.visible || p>.012){
      camera.layers.set(0);camera.layers.enable(WATER_LAYER)
      renderer.setRenderTarget(transmission);renderer.render(scene,camera)
    }
    if(opening.visible)opening.prepare(renderer,camera)
    camera.layers.set(0);camera.layers.enable(QUARTZ_LAYER);camera.layers.enable(WATER_LAYER)
    renderer.setRenderTarget(null);renderer.render(scene,camera)
    if(firstFrame){firstFrame=false;onFirstFrame?.()}
  }
  function schedule(){
    if(!ended&&!document.hidden&&inView&&!frame)frame=requestAnimationFrame(tick)
  }
  function tick(now:number) {
    frame=0
    if(ended||!w||!h||document.hidden||!inView)return
    const running=input.active&&!input.reduced
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
      opening.dispose();gallery.dispose()
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
