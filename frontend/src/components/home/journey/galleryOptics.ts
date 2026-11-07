import * as T from 'three'
import { galleryWorks, galleryAngle, panelWindow, blend } from './galleryPath'

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
float hash(vec2 p){return fract(sin(dot(p,vec2(27.17,91.37)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+1.),u.x),u.y);}
float fbm(vec2 p){return .53*noise(p)+.28*noise(p*2.04+7.)+.14*noise(p*4.11-3.)+.06*noise(p*8.2);}
float rounded(vec2 q){
  vec2 d=abs((q-.5)*vec2(1.53,1.))-vec2(.765-.033,.5-.033);
  return length(max(d,0.))+min(max(d.x,d.y),0.)-.033;
}
void main() {
  float dist=rounded(vUv);
  float aa=max(.0005,fwidth(dist));
  float shape=1.-smoothstep(-aa,aa,dist);
  if(shape<=.001)discard;
  vec3 n=normalize(N)*(gl_FrontFacing?1.:-1.);
  vec3 v=normalize(eye);
  float incidence=clamp(abs(dot(v,n)),0.,1.);
  float rim=pow(1.-incidence,2.);
  bool face=gl_FrontFacing;
  vec2 uv=face?vUv:vec2(1.-vUv.x,vUv.y);
  vec2 src=clamp(projected.xy/projected.w*.5+.5,0.,1.);
  vec2 q=uv*vec2(1.53,1.);
  float t=time*(.093+index*.013)+index*1.37;
  // Liquid filaments continue to advect while the orbit is stationary.
  vec2 warped=q*2.7+vec2(.36*sin(q.y*4.+t),.25*cos(q.x*4.4-t));
  float body=fbm(warped+vec2(t*.22,-t*.29));
  float lobe=fbm(warped*1.62+body*2.7+vec2(.21*t,.14*t));
  float thread=pow(max(0.,1.-abs(lobe-.55)*6.7),3.);
  vec2 bend=n.xy*.026+(uv-.5)*.018
      + .010*vec2(sin(4.*q.y+3.7*body+t),cos(3.*q.x-lobe*4.-t));
  vec3 transmitted = vec3(texture2D(lens,clamp(src+bend*1.09,.001,.999)).r,
                          texture2D(lens,clamp(src+bend,.001,.999)).g,
                          texture2D(lens,clamp(src+bend*.89,.001,.999)).b);
  vec2 im=clamp((q/vec2(1.53,1.)-.5)*.98+.5+vec2((lobe-.5)*.083,(body-.5)*.074)+n.xy*.029,.002,.998);
  vec3 specimen=texture2D(image,im).rgb;
  // Four independent optical films. Their coordinates stay on each surface;
  // neighbouring plates share the same world but do not share a painted wave.
  vec2 lensP=(uv-.5)*vec2(1.53,1.);
  float r=length(lensP), theta=atan(lensP.y,lensP.x);
  float etching;
  if(index<.5){
    float arc=r-(.31+.09*sin(theta*3.+t*.86));
    etching=exp(-abs(arc)*17.)*pow(.5+.5*cos(theta*39.+t*2.+r*33.),2.5);
  } else if(index<1.5) {
    float strata=6.*lensP.y+.72*sin(4.3*lensP.x-t*.95)+.38*cos(5.*lensP.x+4.*lensP.y+t);
    etching=pow(.5+.5*cos(strata*6.8+t),7.)*exp(-1.8*r*r);
  } else if(index<2.5) {
    float rx=dot(lensP,vec2(.86,.51)),ry=dot(lensP,vec2(-.51,.86));
    etching=exp(-26.*abs(length(vec2(rx*1.7,ry))-.33)) +
            .65*exp(-27.*abs(length(vec2((lensP.x+.08*sin(t))*.97,lensP.y*1.72))-.32));
  } else {
    float wave=sin(theta*3.+t+body*5.)+.38*cos(theta*7.-2.*t);
    etching=exp(-26.*abs(r-(.30+.09*wave)))*(.54+.46*cos(theta*11.+t));
  }
  // Uneven pigment and clear windows, not an opaque poster with a coloured overlay.
  float artLight=max(specimen.r,max(specimen.g,specimen.b));
  float clearWindow=smoothstep(.04,.42,abs(uv.x-.56-.17*sin(q.y*4.+t*.38)));
  float pigment=clamp(.12+.49*clearWindow+.48*smoothstep(.08,.6,artLight)+.09*rim,.1,.88);
  pigment*=mix(.35,1.,1.-peel);
  vec3 chroma=mix(tint,vec3(.27,.73,.93),.24+.25*sin(index+5.*lobe));
  vec3 backing=mix(vec3(.036,.047,.069),specimen*1.26,textureReady*.90);
  vec3 colour=mix(transmitted,backing,pigment);
  colour+=chroma*(.02+.17*thread+.29*etching+.08*rim)*(1.-peel*.72);
  float line=1.-smoothstep(aa,aa+.0035,abs(dist+.006));
  float inner=1.-smoothstep(aa,aa+.002,abs(dist+.014));
  float reflection=pow(.5+.5*cos(11.*q.x-7.*q.y+n.x*5.+t*.35),6.);
  colour+=mix(vec3(.45,.65,.70),tint,.48)*line*(.37+.48*reflection+.16*rim)+inner*.09;
  vec2 fringe=n.xy*.0028;
  vec3 label=vec3(texture2D(ink,uv+fringe).a,texture2D(ink,uv).a,texture2D(ink,uv-fringe).a);
  // Reverse faces carry pigment but never mirrored writing.
  float lettering=face?smoothstep(.14,.69,incidence)*(1.-peel):0.;
  colour=mix(colour,vec3(.95,.97,.94),label*lettering*.96);
  // Actual plate alpha reveals the live contents not present in the optical
  // capture (including translucent quartz); refraction supplies a shifted view.
  float alpha=(.53+.20*(1.-incidence)+.15*thread)*mix(1.,.41,peel);
  alpha=max(alpha,max(line*.74,max(max(label.r,label.g),label.b)*lettering*.96));
  gl_FragColor=vec4(colour,shape*alpha*visibility*medium);
}`

function typePlate(i:number) {
  const c=document.createElement('canvas');c.width=896;c.height=584
  const ctx=c.getContext('2d')
  if(!ctx)throw new Error('Type plate unavailable')
  const item=galleryWorks[i]
  ctx.textAlign='center';ctx.fillStyle='#fff'
  ctx.font='500 21px system-ui,sans-serif'
  ctx.fillText(item.code,c.width/2,c.height*.41)
  ctx.font='400 95px "Geist Variable",system-ui,sans-serif'
  ctx.fillText(item.name,c.width/2,c.height*.59)
  ctx.font='500 15px ui-monospace,monospace'
  ctx.textAlign='left';ctx.fillText(`Z30   /   A—${item.number}`,26,39)
  ctx.textAlign='right';ctx.fillText('OPTICAL ARCHIVE',c.width-26,c.height-24)
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
    }
    const material=new T.ShaderMaterial({vertexShader:VS,fragmentShader:FS,uniforms,
      side:T.DoubleSide,transparent:true,depthTest:true,depthWrite:false,forceSinglePass:true})
    const mesh=new T.Mesh(geom,material);mesh.name=`Archive ${work.name}`;mesh.layers.set(1);group.add(mesh)
    return {mesh,uniforms,requested:false}
  })
  const center=new T.Vector3(2.7,.05,-43),spine=new T.Vector3(),anchor=new T.Vector3(),right=new T.Vector3(),
    up=new T.Vector3(),dir=new T.Vector3(),screenAnchor=new T.Vector3(),rotation=new T.Quaternion(),
    viewRotation=new T.Quaternion(),localTurn=new T.Quaternion(),euler=new T.Euler()
  let refraction:T.Texture=blank
  // Each sheet is drawn inside the world. Subtract its projected quad from
  // the separate DOM/glass canvases ONLY while they share the foreground.
  const masks = [
    {selector:'.signal-glass-layer', node:null as HTMLElement|null, cut:'', written:''},
    {selector:'[data-journey="manifesto"]', node:null as HTMLElement|null, cut:'', written:''},
    {selector:'[data-journey="access"]', node:null as HTMLElement|null, cut:'', written:''},
  ]
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
    const tex=new T.TextureLoader().load(`/assets/home/z30-archive-${galleryWorks[i].image}.webp`,img=>{
      if(done)return
      p.uniforms.image.value=img;p.uniforms.textureReady.value=1
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
        ? [.347,.417,.485][Math.min(2,Math.max(0,Math.floor((raw-.32)/.077)))] : p
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
      const width=(5.68+.27*Math.cos(i))*(1-.31*narrow)
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
      const mobileMax=Math.max(2.8,sight*Math.tan(T.MathUtils.degToRad(camera.fov*.5))*camera.aspect*1.53)
      const w=narrow>.5?Math.min(width,mobileMax):width
      mesh.scale.set(w*(1+sheared*.92),w*.652*(1-sheared*.78),w)
      u.time.value=time;u.peel.value=sheared;u.medium.value=finalWindow;u.visibility.value=visible
      u.lens.value=refraction
    }
    const firstMask=p>=.275 && p<.356 && !reduced ? opticalCut(camera,0) : ''
    setCut(0,firstMask);setCut(1,firstMask)
    setCut(2,p>=.533 && p<.648 && !reduced ? opticalCut(camera,3) : '')
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
