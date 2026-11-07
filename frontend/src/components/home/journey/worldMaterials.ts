import * as T from 'three'

export const clock = () => ({ value: 0 })
export type TimeUniform = ReturnType<typeof clock>
const shader = (vertexShader: string, fragmentShader: string, uniforms: T.ShaderMaterialParameters['uniforms'], options: T.ShaderMaterialParameters = {}) =>
  new T.ShaderMaterial({ vertexShader, fragmentShader, uniforms, ...options })

const mist = `
  float haze = 1. - exp(-.00034 * dist*dist);
  col = mix(col, vec3(.034,.045,.061), haze*.88);
`

/** A small synthetic light studio: specular strips, a clearcoat rim, and
 * chromatic edge separation shared by every rock, fin and machine part. */
export function alloy(base: number, edge: number, polish=1) {
  return shader(`
    varying vec3 vN,vEye; varying vec3 vLocal; varying float dist;
    void main(){
      vec4 p=vec4(position,1.); vec3 n=normal;
      #ifdef USE_INSTANCING
        p=instanceMatrix*p; mat3 r=mat3(instanceMatrix);
        n=r*(n/vec3(dot(r[0],r[0]),dot(r[1],r[1]),dot(r[2],r[2])));
      #endif
      vec4 mv=modelViewMatrix*p;
      vN=normalize(normalMatrix*n);vEye=normalize(-mv.xyz);vLocal=position;dist=-mv.z;
      gl_Position=projectionMatrix*mv;
    }
  `, `
    varying vec3 vN,vEye,vLocal; varying float dist;
    uniform vec3 tint,accent; uniform float polish;
    void main(){
      vec3 g=vec3(sin(vLocal.y*3.4+vLocal.z*2.2), sin(vLocal.x*2.9-vLocal.z*1.7),
        cos(vLocal.x*2.2+vLocal.y*3.7));
      vec3 N=normalize(vN+.115*g)*(gl_FrontFacing?1.:-1.);
      vec3 V=normalize(vEye),R=reflect(-V,N);
      float edge=pow(1.-abs(dot(V,N)),2.4);
      float soft=pow(max(0.,dot(R,normalize(vec3(-.48,.51,.67)))),3.);
      float strip=exp(-abs(dot(R,normalize(vec3(.54,.12,.83)))-.46)*15.);
      float glint=pow(max(0.,dot(R,normalize(vec3(.35,.57,.74)))),22.);
      float back=pow(max(0.,dot(R,normalize(vec3(-.68,.18,-.53)))),7.);
      vec3 col=tint*(.35+.77*soft)+accent*(.12+polish*(.43*strip+.25*back)+edge*.67)
        +vec3(.91,.93,1.)*glint*polish*.91;
      vec3 D=refract(-V,N,.69);
      float band=dot(vLocal,vec3(.47,.34,-.19))+dot(D,vec3(.92,-.53,.48));
      float stria=pow(.5+.5*cos(band*18.5+1.2*sin(vLocal.y*4.2)),11.);
      float nacre=smoothstep(.94,1.24,polish)*(.20+.80*smoothstep(.62,1.2,length(vLocal)));
      col+=nacre*stria*(.20+.43*edge)*(.52+.48*cos(2.3*band+vec3(1.2,2.4,4.1)));
      col+=polish*pow(max(.0, 1.-abs(R.y-.38*R.x+.23)),33.)*vec3(.62,.67,.73);
      col+=edge*polish*.19*(.5+.5*cos(5.*R.x + vec3(.2,2.1,4.7)));
      ${mist}
      gl_FragColor=vec4(col,1.);
    }
  `, { tint:{value:new T.Color(base).convertLinearToSRGB()}, accent:{value:new T.Color(edge).convertLinearToSRGB()}, polish:{value:polish} },{side:T.DoubleSide})
}

export function dustMaterial(time:TimeUniform, pixelRatio:TimeUniform, viewport:TimeUniform) {
  return shader(`
    attribute vec3 hue; attribute float size,phase; varying vec3 c; varying float d,alpha;
    uniform float time,pixelRatio,height;
    void main(){
      vec3 p=position;
      p+=vec3(sin(time*.28+phase),cos(time*.19+phase*2.),sin(time*.23+phase*3.))*(.024+.008*size);
      vec4 mv=modelViewMatrix*vec4(p,1.); d=-mv.z; c=hue;
      alpha=(.77+.23*sin(phase+time*.6))*smoothstep(.13,.75,d)/(1.+.0007*d*d);
      gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(size*pixelRatio*height/max(1.,d),1.,44.*pixelRatio);
    }
  `,`
    varying vec3 c; varying float d,alpha;
    void main(){
      vec2 xy=gl_PointCoord*2.-1.; float r=dot(xy,xy); if(r>1.)discard;
      float soft=exp(-5.5*r);
      float glint=exp(-44.*dot(xy+vec2(.14,.18),xy+vec2(.14,.18)));
      gl_FragColor=vec4(c*(.58+soft*.64)+glint*vec3(.24,.23,.24),
        alpha*(.84*soft+.41*glint)*(1.-smoothstep(.54,1.,r)));
    }
  `,{time,pixelRatio,height:viewport},{transparent:true,depthWrite:false,blending:T.AdditiveBlending})
}

// A low-luminance directional atmosphere behind the geometry, not a sky texture.
export function skyMaterial(progress:TimeUniform) {
  return shader(`
    varying vec2 pos; void main(){pos=position.xy;gl_Position=vec4(position.xy, .99999,1.);}
  `,`
    varying vec2 pos; uniform float progress;
    float hash(vec2 p){return fract(sin(dot(p,vec2(31.73,71.2)))*4135.13);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    void main(){
      float gallery=smoothstep(.26,.39,progress)*(1.-smoothstep(.52,.62,progress));
      float api=smoothstep(.50,.64,progress)*(1.-smoothstep(.74,.85,progress));
      float obs=smoothstep(.72,.91,progress);
      vec3 rim=mix(vec3(.095,.17,.15),vec3(.27,.108,.31),gallery);
      rim=mix(rim,vec3(.06,.29,.26),api); rim=mix(rim,vec3(.17,.15,.24),obs);
      vec2 p=pos+vec2(progress*.4,-progress*.18);
      float n=noise(p*3.1)*.48+noise(p*7.7)*.32+noise(p*18.)*.2;
      float cloud=exp(-1.12*length((pos-vec2(.80,.45))*vec2(1.1,1.3)));
      float shaft=pow(max(0.,1.-abs((pos.x*.25+pos.y*.82)-.39)),12.)*.26;
      vec3 col=vec3(.015,.022,.032)+rim*(cloud*(.33+.72*n)+shaft*n)
        +vec3(.035,.026,.067)*exp(-1.7*length(pos-vec2(-1.,-.9)));
      gl_FragColor=vec4(col,1.);
    }
  `,{progress},{depthTest:false,depthWrite:false})
}

export function beamMaterial(colour:number) {
  return shader(`
    varying vec2 U;void main(){U=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `,`
    varying vec2 U; uniform vec3 ink;void main(){
      float beam=pow(max(0.,1.-abs(U.x-.5)*2.),2.)*pow(sin(U.y*3.14159),.8);
      gl_FragColor=vec4(ink,beam*.15);
    }
  `,{ink:{value:new T.Color(colour).convertLinearToSRGB()}},{transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending})
}
/** Instanced soft particulates: a single draw call for spatially localized
 * back-lit vapor, layered behind the individual grains within each bank. */
export function vaporMaterial() {
  return shader(`
    attribute vec2 corner; attribute vec3 ink; attribute vec2 radius; attribute float tilt;
    varying vec2 local; varying vec3 colour; varying float depth;
    void main(){
      vec4 mv=modelViewMatrix*vec4(position,1.);
      float a=tilt;vec2 p=corner*radius;
      mv.xy+=mat2(cos(a),sin(a),-sin(a),cos(a))*p;
      local=corner;colour=ink;depth=-mv.z;
      gl_Position=projectionMatrix*mv;
    }
  `,`
    varying vec2 local; varying vec3 colour; varying float depth;
    float h(vec2 p){return fract(sin(dot(p,vec2(41.13,73.91)))*12724.561);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
    void main(){
      float d=dot(local,local);if(d>.98)discard;
      float curl=noise(local*3.3+depth*.014)*.60+noise(local*7.7)*.26+noise(local*15.3)*.14;
      float density=pow(max(0.,1.-d),2.2) * pow(curl,1.48);
      gl_FragColor=vec4(colour,density*.37*smoothstep(.3,1.6,depth)/(1.+.0009*depth*depth));
    }
  `,{},{depthWrite:false,transparent:true,blending:T.AdditiveBlending})
}
