import * as T from 'three'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { vertex, front, back } from './shaders'

export interface GlassScene {
  input(x: number, y: number): void
  orbit(progress: number): void
  field(source: HTMLCanvasElement): void
  position(p: number): void
  capture(): HTMLCanvasElement
  active(on: boolean): void
  dispose(): void
}

/** One alpha canvas, two draws: exit depth/normals, then dispersive transmission. */
export async function createGlassScene(canvas: HTMLCanvasElement, host: HTMLElement, signal: AbortSignal): Promise<GlassScene> {
  const [svg, image] = await Promise.all([
    fetch('/z30-mono.svg', { signal }).then(r => {
      if (!r.ok) throw new Error('Wordmark outline unavailable')
      return r.text()
    }),
    (async () => {
      const existing = host.querySelector<HTMLImageElement>('.signal-plate')
      const img = existing ?? new Image()
      if (!existing) img.src = '/assets/home/z30-signal-field.webp'
      await img.decode()
      return img
    })(),
  ])
  signal.throwIfAborted()
  const shapes = new SVGLoader().parse(svg.replace(/currentColor/g,'#fff')).paths.flatMap(path => path.toShapes())
  if (shapes.length !== 3 || !shapes.some(s => s.holes.length)) throw new Error('Invalid wordmark geometry')

  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance',
    premultipliedAlpha: true })
  renderer.setClearColor(0x000000, 0)
  const baseDpr = Math.min(1.48, Math.max(1.10, window.devicePixelRatio || 1))
  renderer.setPixelRatio(baseDpr)
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  const camera = new T.PerspectiveCamera(T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(19)/2)*1.5)), 224/138, .1, 750)
  camera.position.z = 292
  const scene = new T.Scene()
  const tex = new T.Texture(image)
  tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true
  const target = new T.WebGLRenderTarget(1,1, { minFilter:T.NearestFilter, magFilter:T.NearestFilter, depthBuffer:true })
  const uniforms = {
    transmissionFrame: { value:tex as T.Texture }, captureMix:{value:0},
    backSurface:{ value:target.texture }, worldPlate:{ value:tex }, bufferSize:{ value:new T.Vector2() },
    orbit:{value:0}, projection:{ value:camera.projectionMatrix }, aim:{ value:new T.Vector2() }, elapsed:{ value:0 },
    stageScale:{ value:new T.Vector2() }, stageOffset:{ value:new T.Vector2() },
    plateScale:{ value:new T.Vector2() }, plateOrigin:{ value:new T.Vector2() },
  }
  const frontMaterial = new T.ShaderMaterial({vertexShader:vertex, fragmentShader:front, uniforms})
  const backMaterial = new T.ShaderMaterial({vertexShader:vertex, fragmentShader:back, side:T.BackSide, toneMapped:false})
  const geometry = toCreasedNormals(new T.ExtrudeGeometry(shapes,{depth:18,bevelEnabled:true,bevelThickness:1.9,bevelSize:1.3,bevelSegments:6,steps:1}), .44)
  // Keep the large flat optical windows planar. Averaging their corner
  // normals over the full caps would turn each cap into a curved metal sheet.
  const rawNormal=geometry.getAttribute('normal'), rawPos=geometry.getAttribute('position')
  for (const group of geometry.groups) if(group.materialIndex===0) {
    for(let i=group.start; i<group.start+group.count;i++) rawNormal.setXYZ(i,0,0,rawPos.getZ(i)>9?1:-1)
  }
  geometry.center()
  const mesh = new T.Mesh(geometry,frontMaterial)
  mesh.scale.y = -1 // SVG y-down to three.js y-up; three.js fixes negative-determinant face winding.
  scene.add(mesh)

  let on=false, stopped=false, frame=0, previous=0, seconds=0
  let x=0,y=0, smoothX=0,smoothY=0, travel=0, scroll=0, enlarged=false
  let captured:T.Texture | null=null, mappingDirty=true
  function draw() {
    const u=uniforms
    if(mappingDirty && captured) {
      mappingDirty=false
      const q=canvas.getBoundingClientRect(),v=host.getBoundingClientRect()
      if(v.width && v.height){
        u.stageScale.value.set(q.width/v.width,q.height/v.height)
        u.stageOffset.value.set((q.left-v.left)/v.width,(v.bottom-q.bottom)/v.height)
      }
    }
    u.captureMix.value=captured ? T.MathUtils.smoothstep(scroll,.105,.18) : 0
    smoothX = x; smoothY = y // The shell supplies a single time-filtered pointer to every layer.
    mesh.rotation.set(-.105+smoothY*.052+Math.sin(seconds*.28)*.022,-.16-travel*1.28+smoothX*.085+Math.sin(seconds*.24)*.047,.008)
    u.orbit.value=Math.min(1, travel+.1*Math.abs(smoothX)); u.elapsed.value=seconds; u.aim.value.set(smoothX,smoothY)
    mesh.material=backMaterial; renderer.setRenderTarget(target); renderer.render(scene,camera)
    mesh.material=frontMaterial; renderer.setRenderTarget(null); renderer.render(scene,camera)
  }
  function resize() {
    if(stopped) return
    const rect=canvas.getBoundingClientRect(), outer=host.getBoundingClientRect()
    if (!rect.width || !rect.height || !outer.width || !outer.height) return
    const width=Math.max(1,Math.round(canvas.clientWidth)), height=Math.max(1,Math.round(canvas.clientHeight))
    renderer.setSize(width,height,false)
    renderer.getDrawingBufferSize(uniforms.bufferSize.value)
    target.setSize(uniforms.bufferSize.value.x,uniforms.bufferSize.value.y)
    camera.aspect=width/height; camera.updateProjectionMatrix()
    // Map canvas pixels back into the hero's object-fit:cover plate (object-position 50% 68%).
    uniforms.stageScale.value.set(rect.width/outer.width,rect.height/outer.height)
    uniforms.stageOffset.value.set((rect.left-outer.left)/outer.width,(outer.bottom-rect.bottom)/outer.height)
    const imgAspect=image.naturalWidth/image.naturalHeight, hostAspect=outer.width/outer.height
    const s=uniforms.plateScale.value.set(Math.min(1,hostAspect/imgAspect),Math.min(1,imgAspect/hostAspect)).multiplyScalar(1/1.018)
    uniforms.plateOrigin.value.set((1-s.x)*.5,(1-s.y)*.32)
    draw()
  }
  function tick(now:number) {
    if(!on || stopped) return
    if(previous) seconds+=Math.min((now-previous)/1000,.075)
    previous=now; draw()
    frame=requestAnimationFrame(tick)
  }
  function active(value:boolean) {
    if(stopped || on===value) return
    on=value
    if(on) { previous=0; frame=requestAnimationFrame(tick) }
    else { cancelAnimationFrame(frame); previous=0 }
  }
  const observer=new ResizeObserver(resize)
  function dispose() {
    if(stopped) return
    active(false); stopped=true; observer.disconnect()
    target.dispose(); captured?.dispose(); tex.dispose(); geometry.dispose(); frontMaterial.dispose(); backMaterial.dispose()
    renderer.dispose(); renderer.forceContextLoss()
  }
  try { observer.observe(host); observer.observe(canvas); resize() } catch (e) { dispose(); throw e }
  function field(source:HTMLCanvasElement){
    captured?.dispose();captured=new T.CanvasTexture(source)
    captured.colorSpace=T.SRGBColorSpace;uniforms.transmissionFrame.value=captured;mappingDirty=true
  }
  function position(p:number) {
    scroll=p;mappingDirty=true
    // Resize the optical buffers only as the mark crosses sizes, never on every
    // scroll frame. The enlarged glass stays sharp without paying for it at rest.
    if((!enlarged && p>.169 && p<.36) || (enlarged && (p<.122 || p>.38))){
      enlarged=!enlarged;renderer.setPixelRatio(enlarged?Math.min(2.15,baseDpr*1.62):baseDpr);resize()
    }
  }
  return { field, position, capture:()=>{ draw(); return canvas }, input:(a,b)=>{x=a;y=b}, orbit:value=>{travel=T.MathUtils.clamp(value,0,1)}, active, dispose }
}
