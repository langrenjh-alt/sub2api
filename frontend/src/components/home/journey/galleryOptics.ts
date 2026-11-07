import * as T from 'three'
import { galleryWorks, galleryAngle, panelWindow, blend, editionFocus, editionIndex } from './galleryPath'

const VS = `
varying vec2 vUv;
varying vec3 eye,N;
varying vec4 projected;
void main() {
  vUv=uv;
  // A slightly bowed sheet of optical glass. The curvature is real geometry,
  // so both the silhouette and the normal vary as it turns around the spine.
  vec3 p=position;
  p.z+=.040*(.5-p.x*p.x*2.)+.019*(.5-p.y*p.y*2.);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  N=normalize(normalMatrix*vec3(.16*p.x,.076*p.y,1.));
  eye=-mv.xyz;
  projected=projectionMatrix*mv;
  gl_Position=projected;
}`
const FS = `
varying vec2 vUv;
varying vec3 eye,N;
varying vec4 projected;
uniform sampler2D lens, image, ink;
uniform float time, medium, visibility, index, textureReady, peel;
uniform vec3 tint;
uniform float sheetAspect, imageAspect;
uniform vec2 cropAnchor;
float hash(vec2 p){return fract(sin(dot(p,vec2(27.17,91.37)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+1.),u.x),u.y);}
float fbm(vec2 p){return .53*noise(p)+.28*noise(p*2.04+7.)+.14*noise(p*4.11-3.)+.06*noise(p*8.2);}
float edgeDistance(vec2 p){
  vec2 uv=min(p,1.-p)*vec2(sheetAspect,1.);
  return min(uv.x,uv.y);
}
void main() {
  vec3 n=normalize(N)*(gl_FrontFacing?1.:-1.);
  vec3 v=normalize(eye);
  float incidence=clamp(abs(dot(v,n)),0.,1.);
  float rim=pow(1.-incidence,2.);
  bool face=gl_FrontFacing;
  vec2 uv=face?vUv:vec2(1.-vUv.x,vUv.y);
  vec2 src=clamp(projected.xy/projected.w*.5+.5,0.,1.);
  vec2 q=uv*vec2(sheetAspect,1.);
  float t=time*.075+index*1.73;
  vec2 field=q*2.1+vec2(.17*sin(q.y*3.4+t),.12*cos(q.x*3.7-t));
  float body=fbm(field+vec2(t*.19,-t*.22));
  float grain=fbm(field*2.23+body*1.28+vec2(-.18*t,.14*t));
  vec2 bend=n.xy*.025+(uv-.5)*.019+.007*vec2(sin(4.*q.y+2.6*body+t),cos(3.*q.x-grain*3.1-t));
  vec3 through=vec3(texture2D(lens,clamp(src+bend*1.065,.001,.999)).r,
                    texture2D(lens,clamp(src+bend,.001,.999)).g,
                    texture2D(lens,clamp(src+bend*.94,.001,.999)).b);
  // Cover, never stretch, the actual macro photograph. Fixed print registration
  // is independent of this slow drift of the material under the glass.
  vec2 cover=vec2(min(1.,sheetAspect/imageAspect),min(1.,imageAspect/sheetAspect));
  float magnify=.95+.017*sin(t*.63+index);
  vec2 crop=cover*magnify;
  vec2 im=(uv-.5)*crop+mix(vec2(.5),cropAnchor,1.-crop)
          +.013*vec2(grain-.5,body-.5)+n.xy*.015;
  vec3 photo=texture2D(image,clamp(im,.001,.999)).rgb;
  // A small unprinted edge admits the shared crystal and the neighbouring
  // panes; its placement varies with the aspect and registration of each work.
  float unprinted=index<.5?smoothstep(.82,.98,uv.x+.05*(uv.y-.5)):
    index<1.5?1.-smoothstep(.012,.13,uv.x+.018*uv.y):
    index<2.5?1.-smoothstep(.015,.11,uv.y-.025*uv.x):smoothstep(.87,.985,uv.x-.04*uv.y);
  float printArea=(.92-unprinted*.86)*(1.-peel);
  vec3 graphite=vec3(.11,.112,.115)+tint*.04;
  vec3 paper=mix(graphite,photo,textureReady);
  float silver=pow(max(0.,1.-abs(3.8*body-1.9+.63*n.x)),5.);
  vec3 colour=mix(through,paper,printArea);
  // Only a grazing reflection and a hairline cut edge, never a glowing frame.
  float soft=exp(-abs(.82*q.y-.29*q.x-.47+.14*sin(t*.58)-n.y*.27)*21.);
  colour+=mix(vec3(.66,.68,.71),tint,.28)*(.016*silver+.063*soft+.055*rim)*(1.-peel*.68);
  float d=edgeDistance(uv);
  colour+=mix(vec3(.24,.25,.25),tint,.24)*(1.-smoothstep(0.,fwidth(d)*1.3,d))*(.24+.45*rim);
  // Lower registration carries the title. A localized vignette keeps etched
  // white ink legible without turning the entire photograph into a dark UI box.
  float register=1.-smoothstep(.02,.45,uv.y);
  colour*=1.-.26*register*printArea;
  vec4 inkPixel=texture2D(ink,uv);
  float inkStrength=face?smoothstep(.08,.65,incidence)*(1.-peel)*inkPixel.a:0.;
  vec3 letter=inkPixel.r*vec3(.96,.955,.935)+inkPixel.g*mix(vec3(.83,.83,.80),tint,.31);
  colour=mix(colour,letter,inkStrength);
  float alpha=mix(.47+.23*rim,.96,printArea)*mix(1.,.45,peel);
  alpha=max(alpha,inkStrength*.98);
  gl_FragColor=vec4(colour,alpha*visibility*medium);
}`

/** A separate ink mask keeps typography registered on the surface while the
 * underlying macro film moves. Red encodes white type, green secondary ink. */
function typePlate(i:number) {
  const item=galleryWorks[i], c=document.createElement('canvas')
  c.width=1152;c.height=Math.round(c.width/item.aspect)
  const ctx=c.getContext('2d')
  if(!ctx)throw new Error('Type plate unavailable')
  const w=c.width,h=c.height,g=Math.round(w*.052)
  const small=(text:string,x:number,y:number,size=23)=>{
    ctx.font=`500 ${size}px "Geist Mono Variable",ui-monospace,monospace`
    ctx.fillStyle='#00ff00';ctx.fillText(text,x,y)
  }
  ctx.textAlign='left'
  small(`Z30  /  ${item.number}`,g,Math.max(g,h*.10))
  ctx.fillStyle='#00ff00';ctx.fillRect(g,h*.15,Math.round(w*.065),1.25)
  const alignRight=item.format==='panorama'
  ctx.textAlign=alignRight?'right':'left'
  const x=alignRight?w-g:g
  const base=item.format==='folio'?.84:.86
  small(item.code,x,h*(base-.19),item.format==='folio'?26:21)
  const size=item.format==='folio'?187:item.format==='canopy'?131:item.format==='panorama'?166:170
  ctx.font=item.format==='panorama'?`italic ${size}px Georgia,serif`:`550 ${size}px "Geist Variable","Arial",sans-serif`
  ctx.fillStyle='#ff0000';ctx.fillText(item.name,x,h*base,w-2*g)
  // The tall folio carries a second, rotated margin signature like a print spine.
  if(item.format==='folio') {
    ctx.save();ctx.translate(w-g,h*.46);ctx.rotate(-Math.PI/2);ctx.textAlign='center'
    small('Z30   /   MODEL LIBRARY',0,0,18);ctx.restore()
  }
  const tex=new T.CanvasTexture(c);tex.minFilter=T.LinearFilter;tex.generateMipmaps=false
  return tex
}

/** All gallery optics render inside the SAME camera/scene/depth buffer as the
 * environment. The owner supplies its opaque-colour capture (layers 0+2).
 * Transparent groups are depth-sorted by the normal facing(camera), not index. */
export function createGalleryOptics(scene:T.Scene, canvas?:HTMLCanvasElement) {
  const group=new T.Group(); group.name='Optical model archive';scene.add(group)
  const geom=new T.PlaneGeometry(1,1,18,12)
  const blank=new T.DataTexture(new Uint8Array([13,20,27,255]),1,1);blank.needsUpdate=true
  const textures:T.Texture[]=[]
  let done=false
  const panels=galleryWorks.map((work,i)=>{
    const type=typePlate(i);textures.push(type)
    const uniforms={
      lens:{value:blank as T.Texture},image:{value:blank as T.Texture},ink:{value:type}, time:{value:0}, medium:{value:0},
      visibility:{value:0},index:{value:i},textureReady:{value:0},peel:{value:0},tint:{value:new T.Vector3(...work.tint)},
      sheetAspect:{value:Number(work.aspect)},imageAspect:{value:1.53},cropAnchor:{value:new T.Vector2(...work.crop)},
    }
    const material=new T.ShaderMaterial({name:'Z30AtelierFilm',vertexShader:VS,fragmentShader:FS,uniforms,
      side:T.DoubleSide,transparent:true,depthTest:true,depthWrite:false,forceSinglePass:true})
    const mesh=new T.Mesh(geom,material);mesh.name=`Archive ${work.name}`;mesh.layers.set(1);group.add(mesh)
    return {mesh,uniforms,requested:false}
  })
  const center=new T.Vector3(2.7,.05,-43),spine=new T.Vector3(),anchor=new T.Vector3(),right=new T.Vector3(),
    up=new T.Vector3(),dir=new T.Vector3(),screenAnchor=new T.Vector3(),rotation=new T.Quaternion(),
    viewRotation=new T.Quaternion(),localTurn=new T.Quaternion(),euler=new T.Euler()
  let refraction:T.Texture=blank
  // Only the HTML access copy needs a cut. Scene geometry handles glass occlusion.
  const masks = [{selector:'[data-journey="access"]', node:null as HTMLElement|null, cut:'', written:''}]
  const clipCorner=new T.Vector3()
  function setCut(index:number,cut:string){
    const layer=masks[index]
    if(layer.cut===cut)return
    if(!layer.node || !layer.node.isConnected)layer.node=
      (canvas?.closest('.signal') ?? document).querySelector<HTMLElement>(layer.selector)
    if(!layer.node)return
    if(cut){layer.node.style.clipPath=cut;layer.written=layer.node.style.clipPath}
    else if(layer.node.style.clipPath===layer.written){layer.node.style.removeProperty('clip-path');layer.written=''}
    layer.cut=cut
  }
  function clearMasks(){masks.forEach((_,i)=>setCut(i,''))}
  function opticalCut(camera:T.Camera,index:number){
    const sheet=panels[index].mesh
    if(!sheet.visible)return ''
    sheet.updateMatrixWorld(true)
    const ring=[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5],[-.5,.5]].map(([x,y])=>{
      clipCorner.set(x,y,.005).applyMatrix4(sheet.matrixWorld).project(camera)
      return `${((clipCorner.x+1)*50).toFixed(2)}% ${((1-clipCorner.y)*50).toFixed(2)}%`
    })
    return `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${ring.join(',')},0% 0%)`
  }
  function requestArt(i:number){
    const p=panels[i];if(p.requested)return;p.requested=true
    const tex=new T.TextureLoader().load(`/assets/home/atelier-${galleryWorks[i].image}.webp`,img=>{
      if(done)return
      p.uniforms.image.value=img;p.uniforms.textureReady.value=1
      const source=img.image as HTMLImageElement
      p.uniforms.imageAspect.value=source.naturalWidth/Math.max(1,source.naturalHeight)
    })
    textures.push(tex)
  }
  function update(camera:T.PerspectiveCamera,p:number,time:number,reduced:boolean,raw:number) {
    const finalWindow=blend(.262,.307,p)*(1-blend(.792,.864,p))
    group.visible=finalWindow>.002
    if(!group.visible){clearMasks();return}
    camera.updateMatrixWorld()
    camera.getWorldDirection(dir)
    right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1)
    // Horizontal handoff to the next room carries the very same final window,
    // not a screen-space crossfade of two drawings.
    const narrow=T.MathUtils.smoothstep(1.08-camera.aspect,0,.39)
    const camAngle=Math.atan2(camera.position.x-center.x,camera.position.z-center.z)
    for(let i=0;i<panels.length;i++){
      const {mesh,uniforms:u}=panels[i]
      const stateP=reduced && p>=.32 && p<.55
        ? editionFocus[editionIndex(raw)] : p
      const transfer=i===3?blend(.525,.585,p):0
      const leaving=i===3?blend(.63,.69,p):0
      const echo=i===3?blend(.72,.78,p)*(1-blend(.811,.858,p)):0
      const visible=panelWindow(stateP,i)*(1-leaving)+echo*.78
      mesh.visible=visible>.002
      if(!mesh.visible)continue
      requestArt(i)
      const angle=galleryAngle(stateP,i)
      const theta=camAngle+angle-.24*(1-narrow)
      const radius=3.88+.25*Math.cos(i*1.6)
      spine.copy(center)
      // Front pane is present while manifesto is still in view; it arrives
      // through the lower foreground and settles onto the shared spindle.
      const arrival=(1-blend(.276,.35,p))
      spine.z+=arrival*10.7;spine.y-=arrival*4.3
      anchor.set(spine.x+Math.sin(theta)*radius,spine.y+.43+Math.sin(i*1.7)*.48,
        spine.z+Math.cos(theta)*radius)
      // Face tangent to the cylindrical orbit. Any two panels have a fixed
      // angular separation and different world depths, including on reversal.
      euler.set(-.045+.026*Math.sin(i)*Math.cos(angle),theta,.022*Math.sin(i+1),'YXZ')
      rotation.setFromEuler(euler)
      const sight=T.MathUtils.clamp(camera.position.distanceTo(anchor),3.3,17)
      const edition=galleryWorks[i]
      const width=edition.width*(1-.29*narrow)
      if(i===0 && p<.37 && !reduced) {
        // Catch the retiring wordmark in the same window that later joins the
        // cylinder. At .30 the lower part of the glass lettering is visibly
        // behind this physical upper edge, not simply fading alongside it.
        const pickup=1-blend(.319,.373,p), asc=blend(.261,.313,p)
        const d=8.3, halfY=d*Math.tan(T.MathUtils.degToRad(camera.fov*.5))
        screenAnchor.copy(camera.position).addScaledVector(dir,d)
          .addScaledVector(right,(.07+.04*asc)*halfY*camera.aspect)
          .addScaledVector(up,(-1.26+1.34*asc+.34*blend(.314,.34,p))*halfY)
        anchor.lerp(screenAnchor,pickup)
        localTurn.setFromEuler(euler.set(-.11,.30-.19*asc,-.08+.05*asc,'YXZ'))
        viewRotation.copy(camera.quaternion).multiply(localTurn)
        rotation.slerp(viewRotation,pickup)
      }
      if(i===3 && transfer>0){
        const depart=blend(.555,.662,p), returnToCrown=blend(.723,.79,p)
        const d=6.9+depart*1.45, yfov=d*Math.tan(T.MathUtils.degToRad(camera.fov*.5))
        const xfov=yfov*camera.aspect
        // In the gallery → connection interval the old work rises and slides
        // left. The conduit/console are visible beneath it BEFORE it clears.
        let sx=.35-.98*depart, sy=.18+1.63*depart
        if(returnToCrown>0){sx=T.MathUtils.lerp(sx,.30,returnToCrown);sy=T.MathUtils.lerp(sy,.80,returnToCrown)}
        screenAnchor.copy(camera.position).addScaledVector(dir,d).addScaledVector(right,sx*xfov).addScaledVector(up,sy*yfov)
        anchor.lerp(screenAnchor,transfer)
        localTurn.setFromEuler(euler.set(.11+depart*.24,-.28-depart*.43,.06-depart*.15,'YXZ'))
        viewRotation.copy(camera.quaternion).multiply(localTurn)
        rotation.slerp(viewRotation,transfer)
      }
      const sheared=i===3?blend(.60,.68,p):0
      mesh.position.copy(anchor);mesh.quaternion.copy(rotation)
      const mobileMax=Math.max(2.8,sight*Math.tan(T.MathUtils.degToRad(camera.fov*.5))*camera.aspect*1.78)
      const w=narrow>.5?Math.min(width,mobileMax):width
      mesh.scale.set(w*(1+sheared*.92),w/edition.aspect*(1-sheared*.78),w)
      u.sheetAspect.value=mesh.scale.x/mesh.scale.y
      u.time.value=time;u.peel.value=sheared;u.medium.value=finalWindow;u.visibility.value=visible
      u.lens.value=refraction
    }
    setCut(0,p>=.533 && p<.587 && !reduced ? opticalCut(camera,3) : '')
  }
  return {
    update,
    setRefraction(texture:T.Texture){refraction=texture;if(canvas)canvas.dataset.archiveOptics='ready'},
    dispose(){
      done=true;clearMasks();if(canvas)delete canvas.dataset.archiveOptics;scene.remove(group);geom.dispose();textures.forEach(t=>t.dispose());blank.dispose()
      panels.forEach(({mesh})=>mesh.material.dispose())
    },
  }
}
