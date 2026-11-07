import * as T from 'three'
import { beamDistance,bondDistance } from './opticalFlight'

export const clock=()=>({value:0})
export type TimeUniform=ReturnType<typeof clock>
export const QUARTZ_LAYER=1, WATER_LAYER=2
export function opticalStudio(){
  return {
    uTime:clock(),uWarmth:clock(),uProgress:clock(),uPacketMetres:clock(),uPlateReady:clock(),
    uAtelierPlate:{value:null as T.Texture|null},
    uKey:{value:new T.Vector3(-.51,.7,.47)},
    uFrame:{value:new T.Vector2(1,1)},uTransmission:{value:null as T.Texture|null},
    uReflection:{value:null as T.Texture|null},uReflectionVP:{value:new T.Matrix4()},
  }
}
export type OpticalStudio=ReturnType<typeof opticalStudio>
export function lightStudio(s:OpticalStudio,t:number,p:number){
  s.uTime.value=t;s.uProgress.value=p;s.uPacketMetres.value=beamDistance(p)+1.23
  // Light follows its own clock; hue is deliberately NOT mapped to the pointer.
  s.uWarmth.value=T.MathUtils.smoothstep(.5-.5*Math.cos(t*.398),.14,.90)
  s.uKey.value.set(-.73+.21*Math.sin(t*.14+p*2.4),.34+.13*Math.cos(t*.17),
    .40+.21*Math.cos(t*.14+p*1.7)).normalize()
}
export function linkStudio(scene:T.Object3D,s:OpticalStudio){
  scene.traverse(o=>{
    const m=(o as T.Mesh).material
    for(const mat of Array.isArray(m)?m:m?[m]:[]){
      if(mat instanceof T.ShaderMaterial)for(const [key,ref] of Object.entries(s))mat.uniforms[key]=ref
    }
  })
}
const shader=(vertexShader:string,fragmentShader:string,uniforms:T.ShaderMaterialParameters['uniforms']={},opt:T.ShaderMaterialParameters={})=>new T.ShaderMaterial({vertexShader,fragmentShader,uniforms,...opt})
const ink=(c:number)=>new T.Color(c).convertLinearToSRGB()

// An angular, moving HDR studio instead of a tint painted on the object.
// The broad strip, narrow strip and distant gel are shared by glass, water and steel.
const studio=/* glsl */`
  uniform float uTime,uWarmth,uProgress,uPlateReady;uniform vec3 uKey;
  uniform sampler2D uAtelierPlate;
  // Spatial lookup of the atelier's own light study. The print is NOT mapped
  // to face UVs: a moving view sees different regions through R and D.
  vec3 lightPrint(vec3 ray,float blur){
    float angle=atan(ray.z,ray.x)+.085*sin(uTime*.10);
    vec2 uv=vec2(.5-.47*cos(angle),.50+.43*ray.y);
    vec3 c=texture2D(uAtelierPlate,uv,blur*3.).rgb;
    return (c*c*.74+max(c-.45,vec3(0.))*1.12)*uPlateReady;
  }
  vec3 gel(){return mix(vec3(.52,.83,1.),vec3(1.,.46,.16),uWarmth);}
  vec3 env(vec3 d,float rough){
    float soft=pow(max(0.,dot(d,uKey)),mix(19.,3.,rough));
    vec3 panel=normalize(vec3(uKey.z,.17,-uKey.x));
    float strip=exp(-abs(dot(d,panel)-.19)*mix(56.,8.,rough))*smoothstep(-.6,.42,d.y+.36*d.z);
    float line=exp(-abs(d.y-.24*d.x+.17+.075*sin(uTime*.21))*mix(105.,13.,rough));
    float lower=pow(max(0.,dot(d,normalize(vec3(-.45,-.26,.76)))),6.);
    // Broad overhead panel establishes a readable metal body. The moving
    // narrow reflections remain several stops brighter than this fill.
    float ceiling=smoothstep(-.52,.95,d.y);
    float broad=pow(max(0.,dot(d,normalize(vec3(-.64,.42,.53)))),2.);
    return vec3(.014,.020,.035)+vec3(.105,.132,.16)*ceiling+gel()*broad*.16
      +lightPrint(d,rough)*mix(.85,.17,rough)
      +gel()*(soft*1.04+1.68*strip)
      +mix(vec3(.94,.89,.82),vec3(.69,.79,1.),uWarmth)*line*1.72
      +mix(vec3(.12,.09,.23),vec3(.17,.065,.11),uWarmth)*lower;
  }
  // Finite studio flags: grazing reflection varies over a large polished
  // face, rather than painting the same constant sky on every facet.
  vec3 flags(vec3 w,vec3 ray,float blur){
    float room=w.z> -32.?w.z-2.:(w.z> -52.?-43.:(w.z> -79.?-62.8:-92.6));
    float t=(room+8.4-w.z)/max(ray.z,.0001);
    if(t<0.||ray.z<.001)return vec3(0.);
    vec2 h=w.xy+ray.xy*t;
    float x=h.x+.34*h.y;
    float top=1.-smoothstep(4.5,7.5,abs(h.y-1.4));
    float silk=(1.-smoothstep(.36+blur,.97+blur,abs(x-.58)))*top;
    float foil=(1.-smoothstep(.058+blur*.25,.22+blur,abs(x-2.09)))*top;
    float sliver=exp(-abs(h.y+.18*h.x-2.65)*mix(36.,7.,blur))*(1.-smoothstep(1.6,4.2,abs(h.x+.55)));
    float bounce=(1.-smoothstep(1.0,4.2,abs(x-5.3)))*(1.-smoothstep(2.7,7.4,abs(h.y+.5)));
    return vec3(.97,.94,.88)*(silk*.85+foil*1.44)+vec3(.91,.96,1.)*sliver*1.59
      +mix(vec3(.33,.45,.51),vec3(.54,.37,.26),uWarmth)*bounce*.44;
  }
  vec3 fog(vec3 col,float d){
    return mix(col,mix(vec3(.032,.048,.061),vec3(.062,.042,.040),uWarmth),.90*(1.-exp(-.00056*d*d)));
  }
  vec3 tone(vec3 c){return 1.-exp(-max(vec3(0.),c));}
`
const surface=/* glsl */`
  varying vec3 nW,vW,vLocal;varying float d;varying vec2 coords;
  void main(){
    vec4 p=vec4(position,1.); vec3 N=normal;
    #ifdef USE_INSTANCING
    p=instanceMatrix*p;mat3 r=mat3(instanceMatrix);
    N=r*(N/vec3(dot(r[0],r[0]),dot(r[1],r[1]),dot(r[2],r[2])));
    #endif
    vec4 mv=modelViewMatrix*p; vec3 nView=normalMatrix*N;
    nW=normalize(vec3(dot(nView,viewMatrix[0].xyz),dot(nView,viewMatrix[1].xyz),dot(nView,viewMatrix[2].xyz)));
    vW=(modelMatrix*p).xyz;vLocal=position;coords=uv;d=-mv.z;gl_Position=projectionMatrix*mv;
  }
`
const varyingSurface='varying vec3 nW,vW,vLocal;varying float d;varying vec2 coords;'

/** Opaque mineral core and brushed metal. Fewer, brighter reflections than a chalk diffuse. */
export function alloy(base:number,edge:number,polish=1){
  return shader(surface,varyingSurface+studio+`
    uniform vec3 tint,accent;uniform float polish;
    void main(){
      vec3 V=normalize(cameraPosition-vW);
      float rough=clamp(1.18-polish,.045,.9);
      vec3 N=normalize(nW+rough*.025*sin(vLocal.yzx*10.))*(gl_FrontFacing?1.:-1.);
      vec3 R=reflect(-V,N);
      float rim=pow(1.-abs(dot(V,N)),3.);
      float lambert=max(.0,dot(N,uKey));
      vec3 stone=tint*(.21+.83*lambert)+accent*.075*rim;
      vec3 studioLight=env(R,rough)+flags(vW,R,rough*.8);
      studioLight=mix(vec3(dot(studioLight,vec3(.24,.66,.10))),studioLight,.38+.30*polish);
      vec3 metal=tint*.085+studioLight*mix(vec3(.73,.76,.81),accent,.43)*(1.01+rim*.68);
      float station=smoothstep(.71,.86,uProgress);
      metal=metal*(1.+.82*station)+gel()*(rim*.18+.025)*station;
      vec3 colour=mix(stone,metal,smoothstep(.37,.98,polish));
      gl_FragColor=vec4(fog(tone(colour),d),1.);
    }`,{tint:{value:ink(base)},accent:{value:ink(edge)},polish:{value:polish}},{side:T.DoubleSide})
}

/** Transmit the actual opaque background with three slightly displaced reads.
 * The solid interior is rendered before this exterior surface, so fractures
 * and occluding mineral cores remain visible in the refracted image. */
export function quartz(absorption:number,thickness:number,film=.72,flow=0,glaze=1){
  const m=shader(surface,varyingSurface+studio+`
    uniform sampler2D uTransmission;uniform vec2 uFrame;uniform vec3 tint;
    uniform float thickness,film,flow,glaze;
    void main(){
      vec3 V=normalize(cameraPosition-vW);
      vec3 N=normalize(nW+.012*sin(vLocal.yzx*4.1))*(gl_FrontFacing?1.:-1.);
      float cosine=clamp(abs(dot(V,N)),0.,1.),fresnel=.045+.955*pow(1.-cosine,4.);
      vec3 R=reflect(-V,N),D=refract(-V,N,.667);
      vec2 bend=(mat3(viewMatrix)*(D+V)).xy;
      vec2 st=gl_FragCoord.xy/max(uFrame,vec2(1.));vec2 refr=bend*min(.14,thickness/max(3.,d));
      vec3 behind=vec3(texture2D(uTransmission,clamp(st+refr*1.048,.001,.999)).r,
        texture2D(uTransmission,clamp(st+refr,.001,.999)).g,
        texture2D(uTransmission,clamp(st+refr*.949,.001,.999)).b);
      float travel=thickness*(.22+.78*(1.-cosine));
      vec3 transmitted=behind*exp(-(vec3(1.12)-tint*.66)*travel*1.08);
      vec3 silver=env(R,.055)+flags(vW,R,0.065);
      float coating=smoothstep(.29,.98,1.-cosine);
      vec3 spectrum=.55+.45*cos(vec3(0.,2.1,4.25)+(dot(R,uKey)*4.8+.15*uTime)*3.);
      // A relatively clear face, a dark sidewall and occasional colored flares.
      float internalCut=pow(.5+.5*cos(dot(vLocal,vec3(1.82,.68,-.42))+dot(D,vec3(2.1,1.16,.58))),5.);
      vec3 volume=tint*(.027+.052*pow(max(0.,dot(-D,uKey)),3.)+.038*internalCut);
      vec3 bounce=lightPrint(normalize(D+.17*vec3(vLocal.x,vLocal.y,-.25*vLocal.z)),.04);
      vec3 inner=bounce*(.12+.32*internalCut)*tint*min(1.,thickness);
      vec3 col=mix(transmitted+glaze*(volume+inner),silver,clamp(.075*glaze+fresnel*.925,0.,1.));
      col+=glaze*(silver*(.14+.38*coating)+spectrum*(film*coating*min(1.,dot(silver,vec3(.33)))*1.7));
      float packet=pow(.5+.5*cos(coords.x*11.-uTime*.95),5.);
      col+=flow*gel()*(.035+packet*.27)*(.39+.61*coating);
      gl_FragColor=vec4(fog(clamp(col,0.,1.),d),1.);
    }`,{tint:{value:ink(absorption)},thickness:{value:thickness},film:{value:film},flow:{value:flow},glaze:{value:glaze}},
    {side:T.FrontSide})
  m.userData.quartz=true
  return m
}

/** The hairline carrier inside each quartz conduit is drawn in the opaque
 * pass, then physically refracted again through the tube around it. */
export function fibre(inkColour:number){
  return shader(surface,varyingSurface+studio+`
    uniform vec3 pigment;
    void main(){vec3 V=normalize(cameraPosition-vW),N=normalize(nW);
      float pulse=pow(.5+.5*cos(coords.x*11.-uTime*.95),6.);
      float edge=pow(1.-abs(dot(N,V)),3.);
      vec3 lit=mix(pigment,gel(),uWarmth*.78);
      vec3 col=lit*(.14+.26*edge+.78*pulse)+env(reflect(-V,N),.15)*.56;
      gl_FragColor=vec4(fog(tone(col),d),1.);}
  `,{pigment:{value:ink(inkColour)}},{side:T.DoubleSide})
}

export function dustMaterial(time:TimeUniform,pixelRatio:TimeUniform,viewport:TimeUniform){
  return shader(`
    attribute vec3 hue;attribute float size,phase;varying vec3 c;varying float d,alpha,focal,grain;
    uniform float time,pixelRatio,height,uWarmth,uProgress;uniform vec3 uKey;
    void main(){
      vec3 p=position;
      p+=vec3(sin(time*.28+phase),cos(time*.19+phase*2.),sin(time*.23+phase*3.))*(.030+.012*size);
      vec4 mv=modelViewMatrix*vec4(p,1.);d=-mv.z;
      float wash=.5+.5*cos(phase*.62+p.z*.24+time*.64);
      float caustic=pow(max(.0,1.-abs(dot(p.xy,uKey.xy)*.24+.67*sin(p.z*.18+time*.28))),5.);
      float chroma=max(max(hue.r,hue.g),hue.b);
      c=mix(hue,mix(vec3(.91,.43,.15),vec3(1.,.84,.53),wash)*chroma,uWarmth*(.44+.54*wash));
      c*=.56+caustic*.88;
      alpha=(.68+.32*wash)*smoothstep(.12,.75,d)/(1.+.0009*d*d);
      focal=smoothstep(3.6,7.,d);grain=fract(phase*121.93);
      float gallery=smoothstep(.28,.39,uProgress)*(1.-smoothstep(.59,.67,uProgress));
      float cap=mix(43.,mix(7.,15.,grain),gallery);
      alpha*=mix(1.,.68+.2*grain,gallery);
      gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*pixelRatio*height/max(.9,d),1.,cap*pixelRatio);
    }
  `,`
    varying vec3 c;varying float d,alpha,focal,grain;
    void main(){
      vec2 xy=gl_PointCoord*2.-1.;float r=dot(xy,xy);if(r>.99)discard;
      float soft=exp(-mix(2.8,6.2,focal)*r);
      float dotLight=exp(-38.*dot(xy+vec2(.14,.18),xy+vec2(.14,.18)));
      if(grain>.83){soft*=max(0.,1.-abs(xy.y-xy.x*.31)*2.)*.72;}
      gl_FragColor=vec4(c*(.64+.83*soft)+dotLight*vec3(.20,.21,.2),
        alpha*(.81*soft+.34*dotLight)*(1.-smoothstep(.54,1.,r)));
    }
  `,{time,pixelRatio,height:viewport},{transparent:true,depthWrite:false,blending:T.AdditiveBlending})
}
export function skyMaterial(progress:TimeUniform){
  return shader('varying vec2 pos;void main(){pos=position.xy;gl_Position=vec4(pos,.99999,1.);}',studio+`
    varying vec2 pos;uniform float progress;
    float hash(vec2 x){return fract(sin(dot(x,vec2(31.73,71.2)))*4135.13);}
    float noise(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    void main(){
      float a=smoothstep(.26,.39,progress)*(1.-smoothstep(.57,.66,progress));
      float b=smoothstep(.55,.69,progress)*(1.-smoothstep(.75,.88,progress));
      vec3 rim=mix(vec3(.09,.16,.15),vec3(.20,.093,.24),a);
      rim=mix(rim,vec3(.06,.20,.18),b);rim=mix(rim,vec3(.15,.145,.2),smoothstep(.76,.92,progress));
      vec2 p=pos+vec2(progress*.42+sin(uTime*.07)*.035,-progress*.19);
      float n=noise(p*3.2)*.52+noise(p*7.9)*.33+noise(p*18.)*.15;
      float cloud=exp(-1.14*length((pos-vec2(.80,.45))*vec2(1.1,1.3)));
      float shaft=pow(max(0.,1.-abs(pos.x*.31+pos.y*.8-.39)),12.);
      vec3 col=vec3(.012,.017,.026)+mix(rim,rim*vec3(1.28,.83,.69),uWarmth)*(cloud*(.31+.58*n))
        +gel()*.052*shaft*n+vec3(.029,.023,.054)*exp(-1.7*length(pos-vec2(-1.,-.9)));
      gl_FragColor=vec4(col,1.);
    }`,{progress},{depthTest:false,depthWrite:false})
}
export function beamMaterial(colour:number){
  return shader('varying vec2 U;void main(){U=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',studio+`
    varying vec2 U;uniform vec3 ink;
    void main(){float beam=pow(max(0.,1.-abs(U.x-.5)*2.),2.)*pow(sin(U.y*3.14159),.8);
      gl_FragColor=vec4(mix(ink,gel(),.43),beam*.13);}
  `,{ink:{value:ink(colour)}},{transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending})
}
export function vaporMaterial(){
  return shader(`
    attribute vec2 corner;attribute vec3 ink;attribute vec2 radius;attribute float tilt;
    varying vec2 local;varying vec3 colour;varying float depth,seed;uniform float uTime,uWarmth;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float a=tilt+.035*sin(uTime*.09+position.z);
      vec2 p=corner*radius;mv.xy+=mat2(cos(a),sin(a),-sin(a),cos(a))*p;
      local=corner;depth=-mv.z;seed=tilt+position.z*.10;
      colour=mix(ink,vec3(1.,.56,.24)*dot(ink,vec3(.33)),uWarmth*.75);gl_Position=projectionMatrix*mv;}
  `,`
    varying vec2 local;varying vec3 colour;varying float depth,seed;uniform float uTime;
    float h(vec2 p){return fract(sin(dot(p,vec2(41.13,73.91)))*12724.561);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
    void main(){float d=dot(local,local);if(d>.98)discard;
      vec2 q=local+vec2(seed+.035*sin(uTime*.11),seed*.37);
      float curl=noise(q*3.3)*.65+noise(q*8.6)*.35;
      float density=pow(1.-d,2.2)*pow(curl,1.48);
      gl_FragColor=vec4(colour,density*.36*smoothstep(.3,1.6,depth)/(1.+.0009*depth*depth));}
  `,{},{depthWrite:false,transparent:true,blending:T.AdditiveBlending})
}

export function liquidFloor(){
  const m=shader(surface,varyingSurface+studio+`
    uniform sampler2D uReflection;uniform mat4 uReflectionVP;
    void main(){
      vec2 q=vW.xz;float t=uTime;
      vec2 ripple=vec2(cos(dot(q,vec2(.56,.81)) *3.14+t*.84)+.47*cos(q.y*7.39-t*1.12),
        sin(q.y*2.91-t*.73)+.45*sin(dot(q,vec2(-.84,.34))*6.04+t*.71));
      vec3 N=normalize(vec3(ripple.x*.036,1.,ripple.y*.048)),V=normalize(cameraPosition-vW);
      float F=.045+.955*pow(1.-max(0.,dot(N,V)),3.);
      vec4 proj=uReflectionVP*vec4(vW+vec3(ripple.x*.090,0.,ripple.y*.14),1.);
      vec2 uv=clamp(proj.xy/max(.1,proj.w)*.5+.5,.003,.997);
      vec2 blur=vec2(.0016,.0012)*(1.+.34*abs(ripple));
      vec3 reflected=texture2D(uReflection,uv).rgb*.46+texture2D(uReflection,uv+blur).rgb*.27+texture2D(uReflection,uv-blur).rgb*.27;
      vec3 R=reflect(-V,N),colour=vec3(.015,.023,.028)+reflected*(.42+.88*F)+env(R,.29)*(.095+.34*F);
      // Local caustics under the suspended source: distorted light sheets fold
      // into short bright ridges, strongest on the basin's near waterline.
      vec2 basin=q-vec2(2.50,-92.6);
      float rad=length(basin*vec2(1.,.76));
      float pool=exp(-.12*dot(basin-vec2(.45,3.6),basin-vec2(.45,3.6))) + .28*exp(-.72*pow(rad-3.65,2.));
      float a=2.49*basin.x+.76*basin.y+sin(basin.y*.86-t*.57);
      float b=3.78*basin.y-.51*basin.x+.83*sin(basin.x*.94+t*.47);
      float fold=cos(a+.72*sin(b))*.62+sin(b+.37*cos(a))*.46;
      float seam=exp(-9.*abs(fold+.12));
      vec3 frost=mix(vec3(.24,.53,.44),vec3(.49,.39,.59),.5+.5*cos(basin.y*1.2+basin.x*.32-t*.42));
      vec3 glow=mix(frost,mix(vec3(.59,.24,.34),vec3(.77,.56,.39),seam),uWarmth*.85);
      colour+=pool*glow*(.043+.39*seam)*(.46+.61*F);
      // A broad penumbra under the plinth and two tight wet contact shadows
      // under its actual feet keep the comparator seated in this pool.
      vec2 sole=vec2(max(0.,abs(basin.x)-1.42),basin.y-.18);
      float contact=.58*exp(-dot(sole*vec2(1.52,1.48),sole*vec2(1.52,1.48)));
      contact+=.38*exp(-8.*dot(basin-vec2(-1.81,.50),basin-vec2(-1.81,.50)));
      contact+=.38*exp(-8.*dot(basin-vec2(1.79,.50),basin-vec2(1.79,.50)));
      colour*=1.-clamp(contact,0.,.80);
      float edge=1.-smoothstep(.70,.995,max(abs(coords.x*2.-1.),abs(coords.y*2.-1.)));
      gl_FragColor=vec4(fog(colour,d),edge*(.58+.38*F));
    }`,{},{transparent:true,depthWrite:false})
  return m
}
/** Satin bench extending under the optical stops. Two broad pools from the
 * real side key separate graphite surfaces without a grid or star field. */
export function benchMaterial(){
  return shader(surface,varyingSurface+studio+`
    void main(){
      vec2 q=vW.xz;
      float ledge=exp(-.48*abs(q.x-(4.6+.46*sin(q.y*.19))));
      float key=exp(-.028*dot(vec2((q.x-2.8)*1.5,(q.y+42.)*.56),vec2((q.x-2.8)*1.5,(q.y+42.)*.56)));
      float second=exp(-.033*dot(vec2((q.x-3.4)*1.9,(q.y+63.)*.62),vec2((q.x-3.4)*1.9,(q.y+63.)*.62)));
      float scratch=.5+.5*cos(q.y*8.+q.x*1.7);
      float occlusion=exp(-.82*dot((q-vec2(3.28,-61.6))*vec2(.80,1.24),(q-vec2(3.28,-61.6))*vec2(.80,1.24)));
      float ribbon=exp(-3.5*abs(q.x-4.85+.21*(q.y+63.)))*exp(-.021*(q.y+63.)*(q.y+63.));
      vec3 col=vec3(.036,.039,.041)+gel()*(.032*ledge+.050*(key+second)*(.85+.15*scratch)+.065*ribbon);
      col*=1.-occlusion*.57;
      float edge=1.-smoothstep(.74,.99,max(abs(coords.x*2.-1.),abs(coords.y*2.-1.)));
      if(edge<.002)discard;gl_FragColor=vec4(fog(col,d),1.);
    }`,{})
}
export function ruledFace(){
  return shader(surface,varyingSurface+studio+`
    void main(){vec3 V=normalize(cameraPosition-vW),N=normalize(nW);
      float angle=atan(vLocal.y,vLocal.x);
      float ruling=.5+.5*cos(angle*96.);
      vec3 ray=env(reflect(-V,N),.15);
      vec3 colour=vec3(.035,.037,.043)+ray*(.37+.43*ruling)+gel()*ruling*.10;
      gl_FragColor=vec4(fog(tone(colour),d),1.);}
  `,{},{side:T.DoubleSide})
}
/** A backlit split slit in a real ceramic target, visible through the bore.
 * The complementary spectra separate genuinely as the observer crosses the lens. */
export function comparatorTarget(){
  return shader(surface,varyingSurface+studio+`
    void main(){
      vec2 uv=vLocal.xy;
      float pupil=length(uv),limit=1.-smoothstep(.74,.98,pupil);
      // Scan a real ceramic detector. Its bright band advances behind the iris,
      // so the blades themselves occult the beam on closure.
      float seek=uTime*.42+smoothstep(.78,.985,uProgress)*1.90;
      float v=uv.x+.22*uv.y-.34*sin(seek);
      float incoming=smoothstep(.908,.961,uProgress);
      float left=exp(-pow(54.*(v+.19),2.)),right=exp(-pow(24.*(v-.15),2.));
      float ruling=sin(142.*(uv.x-.16*uv.y))*(1.-smoothstep(.4,2.2,fwidth(142.*uv.x)));
      float spot=exp(-dot(uv,uv)*23.)*incoming;
      float cut=exp(-4.8*abs(v-.15))*(1.-smoothstep(.42,.85,abs(uv.y+.08)));
      vec3 field=mix(vec3(.34,.65,.76),vec3(.89,.60,.44),uWarmth*.80);
      vec3 col=vec3(.021,.029,.035)+field*(.18+.012*ruling)*limit+cut*limit*field*(.49+.17*incoming);
      col+=limit*(vec3(.93,.93,.79)*left+field*right)*1.54;
      col+=vec3(.45,.77,.87)*spot;
      gl_FragColor=vec4(fog(col,d),1.);
    }`)
}
/** Satin ceramic is an insulator, not chrome painted white. A soft diffuse
 * body, narrow glazed shoulder and occasional raking highlight distinguish it. */
export function ceramicFinish(){
  return shader(surface,varyingSurface+studio+`
    void main(){vec3 N=normalize(nW),V=normalize(cameraPosition-vW);
      float diffuse=.28+.72*max(0.,dot(N,uKey));
      float grazing=pow(1.-abs(dot(N,V)),3.);
      vec3 neutral=mix(vec3(.79,.77,.71),vec3(.85,.77,.65),uWarmth*.56);
      vec3 coat=env(reflect(-V,N),.36)+flags(vW,reflect(-V,N),.43);
      vec3 col=neutral*(.36+.69*diffuse)+coat*(.07+.27*grazing);
      gl_FragColor=vec4(fog(tone(col),d),1.);}
  `,{},{side:T.DoubleSide})
}
/** Real diagonal coated face between the two prisms, visible in transmission. */
export function bondCoat(){
  return shader(surface,varyingSurface+studio+`uniform float uPacketMetres;
    void main(){vec3 V=normalize(cameraPosition-vW);float c=abs(dot(V,normalize(nW)));
      float edge=1.-smoothstep(.012,.084,min(coords.y,1.-coords.y));
      float lamina=.5+.5*cos(vLocal.x*4.1+c*5.4+.10*uTime);
      vec3 glint=mix(vec3(.24,.50,.63),vec3(.75,.60,.39),lamina);
      float phase=mod(3.34-uTime*1.55-(uProgress-.57)*15.+4.2,8.4)-4.2;
      float arrival=mix(phase,uPacketMetres-${bondDistance.toFixed(5)},smoothstep(.55,.61,uProgress));
      float impact=exp(-dot(vLocal.xy,vLocal.xy)*8.)*exp(-arrival*arrival/.42);
      gl_FragColor=vec4(glint*(.39+.51*(1.-c)+.39*edge)+impact*vec3(.84,.88,.79),.24+.33*(1.-c)+.25*edge+.12*impact);}
  `,{},{transparent:true,depthWrite:false,side:T.DoubleSide})
}
/** One packet propagation clock, converted to optical distance on each arm.
 * At distance zero in either output, phase equals phase at the incoming bond. */
export function instrumentBeam(start:number,length:number,branch:number){
  return shader(surface,varyingSurface+studio+`
    uniform float pathStart,pathLength,branch,uPacketMetres;
    void main(){
      float x=pathStart+pathLength*coords.x;
      float travelled=uTime*1.55+(uProgress-.57)*15.;
      float delta=mod(x-travelled+4.2,8.4)-4.2;
      if(uProgress>.61)delta=x-3.34+${bondDistance.toFixed(5)}-uPacketMetres;
      float packet=exp(-delta*delta/.17), tail=exp(-abs(delta+.45)*3.6);
      vec3 c=branch<.5?vec3(.76,.82,.83):branch<1.5?vec3(.42,.75,.88):vec3(.90,.69,.42);
      float skin=.72+.28*pow(1.-abs(dot(normalize(nW),normalize(cameraPosition-vW))),2.);
      vec3 col=c*skin*(.35+1.21*packet+.32*tail);
      gl_FragColor=vec4(fog(col,d),1.);
    }`,{pathStart:{value:start},pathLength:{value:length},branch:{value:branch}})
}
/** Blade pivots and the moving scan rake individual facets, leaving the
 * aperture void intact. The subdued ruling is filtered at grazing angles. */
export function coatedBlade(){
  const vs='varying vec3 brushing;'+surface.replace('vW=(modelMatrix*p).xyz;', `
      #ifdef USE_INSTANCING
      brushing=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*vec3(1.,0.,0.));
      #else
      brushing=normalize(mat3(modelMatrix)*vec3(1.,0.,0.));
      #endif
      vW=(modelMatrix*p).xyz;`)
  return shader(vs,'varying vec3 brushing;'+varyingSurface+studio+`
    void main(){vec3 N=normalize(nW+.041*brushing*sin(vLocal.y*3.4)),V=normalize(cameraPosition-vW);
      vec3 R=reflect(-V,N);float f=abs(dot(V,N));
      float grain=sin(150.*vLocal.y+24.*vLocal.x);
      float cutoff=1.-smoothstep(.35,1.3,fwidth(vLocal.y*150.));
      vec3 studioLight=env(R,.24)+flags(vW,R,.24);
      float mono=dot(studioLight,vec3(.33,.45,.22));
      float directional=pow(abs(dot(R,brushing)),2.);
      vec3 col=vec3(.029,.038,.043)+vec3(.42,.50,.55)*mono*(.43+.59*directional)+
        studioLight*.17+gel()*(1.-f)*.14+grain*cutoff*.011;
      gl_FragColor=vec4(fog(tone(col),d),1.);
    }`,{},{side:T.DoubleSide})
}

/** A single travelling line guides the eye from the cube into the scanning
 * head. Contrast peaks only around the camera's current handoff region. */
export function relayGuide(){
  return shader(surface,varyingSurface+studio+`
    void main(){vec3 N=normalize(nW),V=normalize(cameraPosition-vW);
      float arrival=smoothstep(.50,.91,uProgress);
      float dist=coords.x-(.055+.93*arrival+.012*sin(uTime*.55));
      float glint=exp(-dist*dist/.0011);
      vec3 l=mix(vec3(.54,.77,.81),vec3(.91,.73,.51),arrival*.69);
      vec3 col=env(reflect(-V,N),.16)*.44+l*(.098+.91*glint);
      gl_FragColor=vec4(fog(tone(col),d),1.);}
  `,{},{side:T.DoubleSide})
}
/** Fine tool marks are local to the part: stainless faces reflect mostly
 * neutral light, while colour is reserved for the dielectric coatings. */
export function turnedMetal(base:number,mirror:number=.8){
  return shader(surface,varyingSurface+studio+`
    uniform vec3 pigment;uniform float mirror;
    void main(){
      vec3 N=normalize(nW)*(gl_FrontFacing?1.:-1.);
      vec3 V=normalize(cameraPosition-vW),R=reflect(-V,N);
      float side=1.-abs(dot(V,N));
      float cycles=vLocal.z*172.+.061*atan(vLocal.y,vLocal.x);
      float groove=sin(cycles)*max(0.,1.-smoothstep(.50,2.2,fwidth(cycles)));
      float rough=mix(.47,.09,mirror);
      vec3 bath=env(R,rough)+flags(vW,R,rough*.84);
      float neutral=dot(bath,vec3(.24,.65,.11));
      vec3 metal=mix(vec3(neutral),bath,.10)*mix(vec3(.78,.80,.82),pigment,.18);
      vec3 colour=pigment*(.12+.21*max(.0,dot(N,uKey)))+metal*(.42+.77*mirror+.19*side);
      colour+=groove*.011*(.23+.77*side)+vec3(.095,.10,.103)*side*mirror;
      gl_FragColor=vec4(fog(tone(colour),d),1.);
    }`,{pigment:{value:ink(base)},mirror:{value:mirror}},{side:T.DoubleSide})
}

/** Radiance of one selected optical path, expressed in metres along its real
 * geometry. Background pilot light persists when the scroll-driven crest stops. */
export function flightRadiance(length:number,halo:boolean){
  return shader(surface,varyingSurface+studio+`
    uniform float uPacketMetres,metres,halo;
    void main(){
      float dist=coords.x*metres, delta=dist-uPacketMetres;
      float peak=exp(-delta*delta/.22);
      float tail=exp(-abs(delta+.33)*2.1);
      float idle=.5+.5*cos(dist*1.7-uTime*1.18);
      vec3 pigment=mix(vec3(.68,.79,.85),vec3(.31,.82,.98),smoothstep(${bondDistance.toFixed(5)}-.1,${bondDistance.toFixed(5)}+.3,dist));
      float grazing=abs(dot(normalize(nW),normalize(cameraPosition-vW)));
      float nearFade=smoothstep(mix(.12,.37,halo),mix(.82,1.75,halo),d);
      float a=nearFade*mix(.50+.13*idle,.033+.095*tail,halo);
      vec3 color=pigment*(.36+.095*idle+.76*tail)+vec3(.53,.54,.52)*peak;
      gl_FragColor=vec4(fog(color,d),a*mix(1.,pow(grazing,.65),halo));
    }`,{metres:{value:length},halo:{value:halo?1:0}},
    {side:T.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending})
}
