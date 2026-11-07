import * as T from 'three'

export const clock=()=>({value:0})
export type TimeUniform=ReturnType<typeof clock>
export const QUARTZ_LAYER=1, WATER_LAYER=2
export function opticalStudio(){
  return {
    uTime:clock(),uWarmth:clock(),uProgress:clock(),
    uKey:{value:new T.Vector3(-.51,.7,.47)},
    uFrame:{value:new T.Vector2(1,1)},uTransmission:{value:null as T.Texture|null},
    uReflection:{value:null as T.Texture|null},uReflectionVP:{value:new T.Matrix4()},
  }
}
export type OpticalStudio=ReturnType<typeof opticalStudio>
export function lightStudio(s:OpticalStudio,t:number,p:number){
  s.uTime.value=t;s.uProgress.value=p
  // Light follows its own clock; hue is deliberately NOT mapped to the pointer.
  s.uWarmth.value=T.MathUtils.smoothstep(.5-.5*Math.cos(t*.398),.14,.90)
  s.uKey.value.set(-.42+.44*Math.sin(t*.16+p*3),.66+.14*Math.cos(t*.21),
    .48+.36*Math.cos(t*.15+p*1.8)).normalize()
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
  uniform float uTime,uWarmth,uProgress; uniform vec3 uKey;
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
      +gel()*(soft*1.04+1.68*strip)
      +mix(vec3(.94,.89,.82),vec3(.69,.79,1.),uWarmth)*line*1.72
      +mix(vec3(.12,.09,.23),vec3(.17,.065,.11),uWarmth)*lower;
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
      vec3 metal=tint*.085+env(R,rough)*mix(vec3(.73,.76,.81),accent,.43)*(1.01+rim*.68);
      float station=smoothstep(.71,.86,uProgress);
      metal=metal*(1.+.82*station)+gel()*(rim*.18+.025)*station;
      vec3 colour=mix(stone,metal,smoothstep(.37,.98,polish));
      gl_FragColor=vec4(fog(tone(colour),d),1.);
    }`,{tint:{value:ink(base)},accent:{value:ink(edge)},polish:{value:polish}},{side:T.DoubleSide})
}

/** Transmit the actual opaque background with three slightly displaced reads.
 * The solid interior is rendered before this exterior surface, so fractures
 * and occluding mineral cores remain visible in the refracted image. */
export function quartz(absorption:number,thickness:number,film=.72,flow=0){
  const m=shader(surface,varyingSurface+studio+`
    uniform sampler2D uTransmission;uniform vec2 uFrame;uniform vec3 tint;
    uniform float thickness,film,flow;
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
      vec3 silver=env(R,.055);
      float coating=smoothstep(.29,.98,1.-cosine);
      vec3 spectrum=.55+.45*cos(vec3(0.,2.1,4.25)+(dot(R,uKey)*4.8+.15*uTime)*3.);
      // A relatively clear face, a dark sidewall and occasional colored flares.
      vec3 volume=tint*(.024+.053*pow(max(0.,dot(-D,uKey)),3.));
      vec3 col=mix(transmitted+volume,silver,clamp(.075+fresnel*.925,0.,1.));
      col+=silver*(.14+.38*coating)+spectrum*(film*coating*min(1.,dot(silver,vec3(.33)))*1.7);
      float packet=pow(.5+.5*cos(coords.x*11.-uTime*.95),5.);
      col+=flow*gel()*(.035+packet*.27)*(.39+.61*coating);
      gl_FragColor=vec4(fog(clamp(col,0.,1.),d),1.);
    }`,{tint:{value:ink(absorption)},thickness:{value:thickness},film:{value:film},flow:{value:flow}},
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
      vec2 basin=q-vec2(2.15,-93.0);
      float rad=length(basin*vec2(1.,.76));
      float pool=exp(-.052*dot(basin-vec2(.35,3.9),basin-vec2(.35,3.9))) + .49*exp(-.54*pow(rad-3.9,2.));
      float a=2.49*basin.x+.76*basin.y+sin(basin.y*.86-t*.57);
      float b=3.78*basin.y-.51*basin.x+.83*sin(basin.x*.94+t*.47);
      float fold=cos(a+.72*sin(b))*.62+sin(b+.37*cos(a))*.46;
      float seam=exp(-9.*abs(fold+.12));
      vec3 frost=mix(vec3(.16,.66,.49),vec3(.51,.36,.78),.5+.5*cos(basin.y*1.2+basin.x*.32-t*.42));
      vec3 glow=mix(frost,mix(vec3(.59,.24,.34),vec3(.77,.56,.39),seam),uWarmth*.85);
      colour+=pool*glow*(.066+.51*seam)*(.46+.61*F);
      float edge=1.-smoothstep(.70,.995,max(abs(coords.x*2.-1.),abs(coords.y*2.-1.)));
      gl_FragColor=vec4(fog(colour,d),edge*(.58+.38*F));
    }`,{},{transparent:true,depthWrite:false})
  return m
}
/** Suspended optical organism: forward scatter along a continuous mineral skin,
 * in addition to thousands of sharply focused grains on its surface. */
export function jewelSkin(){
  return shader(surface,varyingSurface+studio+`
    void main(){
      vec3 V=normalize(cameraPosition-vW),N=normalize(nW)*(gl_FrontFacing?1.:-1.);
      float rim=pow(1.-abs(dot(N,V)),2.5);
      float a=atan(vLocal.y,vLocal.x),arc=.52+.48*cos(a*1.8-uTime*.48);
      float incision=pow(.5+.5*cos(dot(vLocal,vec3(7.,13.,17.))+.8*sin(a*5.)),9.);
      vec3 cold=mix(vec3(.22,.82,.71),vec3(.84,.69,1.),arc);
      vec3 warm=mix(vec3(.98,.39,.30),vec3(1.,.83,.61),arc);
      vec3 glow=mix(cold,warm,uWarmth)*(.19+.47*arc+.68*rim+.26*incision);
      glow+=env(reflect(-V,N),.14)*(.19+.5*rim);
      gl_FragColor=vec4(glow,.26+.32*arc+.30*rim);
    }`,{},{transparent:true,depthWrite:false,side:T.FrontSide})
}
export function nucleusMaterial(time:TimeUniform,pixelRatio:TimeUniform,viewport:TimeUniform){
  return shader(`
    attribute vec3 hue;attribute float size,phase;
    varying vec3 light;varying float power;
    uniform float time,uWarmth,height,pixelRatio;
    void main(){vec3 p=position+.016*sin(phase+position.yzx*4.+time*.65);
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      float a=atan(p.y,p.x);
      float sector=.5+.5*cos(a*1.7-time*.49+p.z*.8);
      float cut=.5+.5*cos(phase*3.7+time*1.3);
      vec3 cold=mix(vec3(.25,1.,.65),vec3(.76,.63,1.),sector);
      vec3 hot=mix(vec3(1.,.31,.30),vec3(1.,.86,.63),sector);
      light=mix(cold,hot,uWarmth)*mix(.9,1.72,cut)*(.62+.6*sector)+hue*.21;
      power=.58+.42*cut;gl_PointSize=clamp((size+.018)*height*pixelRatio/max(1.,-mv.z),1.5,17.*pixelRatio);
    }`,`varying vec3 light;varying float power;
      void main(){vec2 xy=gl_PointCoord*2.-1.;float r=dot(xy,xy);if(r>=1.)discard;
      float f=exp(-4.*r);gl_FragColor=vec4(light*(.65+f*.58)+f*f*.21,power*f);}`,
    {time,pixelRatio,height:viewport},{transparent:true,depthWrite:false,blending:T.AdditiveBlending})
}
