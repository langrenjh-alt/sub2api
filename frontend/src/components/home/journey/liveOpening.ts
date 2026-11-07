import * as T from 'three'
import { openingWingCount, wingGeometry, wordGeometry } from './openingGeometry'
import { crystalExit, crystalFront, crystalVertex } from './openingOptics'
import { createOpeningStrands } from './openingField'

const GLASS_LAYER=1
const makeTarget=(nearest=false)=>new T.WebGLRenderTarget(1,1,{
  minFilter:nearest?T.NearestFilter:T.LinearFilter,magFilter:nearest?T.NearestFilter:T.LinearFilter,
  depthBuffer:true, stencilBuffer:false, generateMipmaps:false,
})
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v))

/** The same world/camera owns all dielectrics. No second renderer, DOM
 * glass canvas, static environment photograph or scroll-controlled turntable.
 * Call prepare() after the opaque field render, before the main scene render. */
export function createLiveOpening(scene:T.Scene) {
  const group=new T.Group(); group.name='Opening / optical passage';scene.add(group)
  const fieldGroup=new T.Group();group.add(fieldGroup)
  const strands=createOpeningStrands(fieldGroup)
  const black=new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true
  const exits=new T.Scene(),composite=new T.Scene()
  const exitMaterial=new T.ShaderMaterial({name:'Z30ExitDepthNormal',vertexShader:crystalVertex,fragmentShader:crystalExit,side:T.BackSide,toneMapped:false})
  const blitGeo=new T.PlaneGeometry(2,2)
  const blitMat=new T.ShaderMaterial({
    name:'Z30OpticalBackgroundCopy',uniforms:{source:{value:black as T.Texture}},
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,.9999,1.);}`,
    fragmentShader:`varying vec2 v;uniform sampler2D source;void main(){gl_FragColor=texture2D(source,v);}`,
    depthTest:false,depthWrite:false,toneMapped:false,
  })
  const blit=new T.Mesh(blitGeo,blitMat);blit.frustumCulled=false;blit.renderOrder=-100;composite.add(blit)
  const assets=[...Array.from({length:openingWingCount},(_,i)=>wingGeometry(i)),wordGeometry()]
  const letterIndex=assets.length-1
  const solids=assets.map((geo,i)=>{
    const isWord=i===letterIndex,back=makeTarget(false)
    const uniforms={
      backDepth:{value:back.texture},field:{value:black as T.Texture},resolution:{value:new T.Vector2(1,1)},
      projection:{value:new T.Matrix4()},clock:{value:0},word:{value:isWord?1:0},
      exitWindow:{value:new T.Vector4()},ior:{value:isWord?1.535:1.505},dispersion:{value:isWord?.005:.0055},
    }
    const mat=new T.ShaderMaterial({name:isWord?'Z30LiveLetters':'Z30LiveCrystalWing',
      uniforms,vertexShader:crystalVertex,fragmentShader:crystalFront,side:T.FrontSide,toneMapped:false,
    })
    const mesh=new T.Mesh(geo,mat);mesh.name=isWord?'Z30 / extruded glass':'Wing / '+i
    mesh.layers.set(GLASS_LAYER);group.add(mesh)
    const proxy=new T.Mesh(geo,exitMaterial);proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;exits.add(proxy)
    const frontProxy=new T.Mesh(geo,mat);frontProxy.matrixAutoUpdate=false;frontProxy.frustumCulled=false;composite.add(frontProxy)
    return {mesh,proxy,frontProxy,mat,uniforms,back,isWord,window:uniforms.exitWindow.value}
  })
  const letters=solids[letterIndex].mesh
  letters.position.set(0,.2,7.1);letters.rotation.set(-.088,-.22,-.012)
  const farField=makeTarget(),nearField=makeTarget()
  let field:T.Texture=black,frame=new T.Vector2(1,1),on=false,ended=false
  let w=0,h=0,checkedFormat=false
  const viewProjection=new T.Matrix4(),v=new T.Vector3(),v2=new T.Vector3(),frustum=new T.Frustum()
  const clear=new T.Color()
  function resize(){
    const nw=Math.max(1,Math.round(frame.x)),nh=Math.max(1,Math.round(frame.y))
    if(nw===w&&nh===h)return
    w=nw;h=nh
    for(const b of solids){
      const d=b.isWord?1:.86
      b.back.setSize(Math.max(1,Math.round(w*d)),Math.max(1,Math.round(h*d)))
    }
    farField.setSize(Math.max(1,Math.round(w*.78)),Math.max(1,Math.round(h*.78)))
    nearField.setSize(Math.max(1,Math.round(w*.78)),Math.max(1,Math.round(h*.78)))
  }
  function bounds(camera:T.PerspectiveCamera,b:typeof solids[number]){
    if(!frustum.intersectsObject(b.mesh))return false
    const bb=b.mesh.geometry.boundingBox!
    let l=1,r=0,bot=1,top=0,crossNear=false
    for(let j=0;j<8;j++){
      v.set(j&1?bb.max.x:bb.min.x,j&2?bb.max.y:bb.min.y,j&4?bb.max.z:bb.min.z).applyMatrix4(b.mesh.matrixWorld)
      if(v2.copy(v).applyMatrix4(camera.matrixWorldInverse).z>-camera.near)crossNear=true
      v.applyMatrix4(viewProjection)
      l=Math.min(l,.5+.5*v.x);r=Math.max(r,.5+.5*v.x);bot=Math.min(bot,.5+.5*v.y);top=Math.max(top,.5+.5*v.y)
    }
    if(crossNear){l=bot=0;r=top=1}
    // Pad the box for bilinear filtering / edge lookups. Outside the box the
    // offscreen buffer is ignored by the shader's back-depth validation.
    const pad=.018
    l=clamp(l-pad,0,1);r=clamp(r+pad,0,1);bot=clamp(bot-pad,0,1);top=clamp(top+pad,0,1)
    b.window.set(l,bot,r,top);return r>l&&top>bot
  }
  function update(camera:T.PerspectiveCamera,p:number,time:number,reduced:boolean){
    if(ended)return
    on=p<.235
    group.visible=on
    if(!on)return
    resize()
    const t=reduced?0:time
    const ratio=clamp(camera.aspect/1.665,.25,1.42)
    const ww=2.64+2.03*T.MathUtils.smoothstep(camera.aspect,.47,1.32)
    letters.scale.setScalar(ww)
    for(let i=0;i<openingWingCount;i++)solids[i].mesh.scale.set(ratio,1,1)
    strands.update(t);group.updateMatrixWorld(true)
    camera.updateMatrixWorld()
    viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(viewProjection)
    for(const b of solids){
      b.mesh.visible=bounds(camera,b)
      if(!b.mesh.visible)continue
      b.uniforms.clock.value=t;b.uniforms.resolution.value.set(w,h);b.uniforms.projection.value.copy(camera.projectionMatrix)
      b.proxy.matrix.copy(b.mesh.matrixWorld);b.frontProxy.matrix.copy(b.mesh.matrixWorld)
      b.proxy.matrixWorldNeedsUpdate=true;b.frontProxy.matrixWorldNeedsUpdate=true
    }
  }
  function prepare(renderer:T.WebGLRenderer,camera:T.PerspectiveCamera) {
    if(!on||ended||!solids.some(b=>b.mesh.visible))return
    resize()
    if(!checkedFormat){
      checkedFormat=true
      if(renderer.extensions.has('EXT_color_buffer_float'))for(const b of solids){
        b.back.texture.type=T.HalfFloatType;b.back.dispose()
      }
    }
    const original=renderer.getRenderTarget(),cubeFace=renderer.getActiveCubeFace(),level=renderer.getActiveMipmapLevel(),
      mask=camera.layers.mask, alpha=renderer.getClearAlpha(),auto=renderer.autoClear
    renderer.getClearColor(clear)
    try {
      camera.layers.set(0);renderer.autoClear=true;renderer.setClearColor(0x000000,0)
      for(const b of solids){b.proxy.visible=false;b.frontProxy.visible=false}
      // Four independent back-surface buffers prevent an adjoining crystal
      // from contributing the exit normal of a completely different solid.
      for(const b of solids)if(b.mesh.visible){
        const rt=b.back,s=b.window
        const x=Math.floor(s.x*rt.width),y=Math.floor(s.y*rt.height)
        rt.scissor.set(x,y,Math.ceil(s.z*rt.width)-x,Math.ceil(s.w*rt.height)-y);rt.scissorTest=true
        b.proxy.visible=true;renderer.setRenderTarget(rt);renderer.render(exits,camera);b.proxy.visible=false
      }
      function include(target:T.WebGLRenderTarget,src:T.Texture,solid:typeof solids[number]){
        blitMat.uniforms.source.value=src;solid.frontProxy.visible=true
        const u=solid.uniforms;u.field.value=src;u.resolution.value.set(target.width,target.height)
        renderer.setRenderTarget(target);renderer.render(composite,camera)
        u.resolution.value.set(w,h);solid.frontProxy.visible=false
        return target.texture
      }
      const far=solids[2],word=solids[letterIndex]
      far.uniforms.field.value=field
      const fieldForWord=far.mesh.visible?include(farField,field,far):field
      word.uniforms.field.value=fieldForWord
      const hasNear=solids[0].mesh.visible||solids[1].mesh.visible
      const fieldForNear=hasNear && word.mesh.visible ? include(nearField,fieldForWord,word) : fieldForWord
      solids[0].uniforms.field.value=fieldForNear;solids[1].uniforms.field.value=fieldForNear
    } finally {
      camera.layers.mask=mask;renderer.setRenderTarget(original,cubeFace,level)
      renderer.setClearColor(clear,alpha);renderer.autoClear=auto
    }
  }
  return {
    get visible(){return on},
    setField(texture:T.Texture,size:T.Vector2){field=texture;frame=size},
    update,prepare,
    dispose(){
      if(ended)return
      ended=true;on=false;scene.remove(group);strands.dispose()
      for(const s of solids){s.mesh.geometry.dispose();s.mat.dispose();s.back.dispose()}
      black.dispose();blitGeo.dispose();blitMat.dispose();exitMaterial.dispose();farField.dispose();nearField.dispose()
      exits.clear();composite.clear();group.clear()
    },
  }
}
