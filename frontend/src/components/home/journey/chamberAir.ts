import * as T from 'three'

/**
 * Suspended caustics in the space BEHIND the type. Each strip is a folded,
 * depth-tested volume slice; its perspective and overlap come from the same
 * camera as the glass. These are light sources for transmission, not backdrops.
 */
export function createChamberAir(scene:T.Scene) {
  const group=new T.Group();group.name='Light well / suspended caustics';scene.add(group)
  const clock={value:0},intensity={value:1},height={value:800}
  function centre(x:number,j:number){
    return new T.Vector3(x,(j===0?.43:-.15)+x*(j===0?.30:-.20)+.52*Math.sin(x*.31+j*2.1),
      (j===0?-2.9:-8.2)-.92*Math.cos(x*.26+j)+x*.19)
  }
  for(let j=0;j<2;j++){
    const n=112,rows=8,positions:number[]=[],uv:number[]=[],indices:number[]=[]
    for(let i=0;i<=n;i++){
      const x=-19+38*i/n, at=centre(x,j),span=(j===0?1.45:2.5)*(.76+.33*Math.cos(x*.23+j))
      for(let k=0;k<=rows;k++){
        const f=k/rows*2-1
        positions.push(at.x,at.y+f*span,at.z+f*f*.52+f*.36*Math.sin(x*.34+j));uv.push(i/n,k/rows)
        if(i<n&&k<rows){const l=i*(rows+1)+k;indices.push(l,l+1,l+rows+1,l+1,l+rows+2,l+rows+1)}
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3))
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices)
    const mat=new T.ShaderMaterial({name:'Z30SuspendedCaustic',uniforms:{clock,intensity,layer:{value:j}},
      vertexShader:`varying vec2 coords;varying float dist;void main(){coords=uv;vec4 p=modelViewMatrix*vec4(position,1.);dist=-p.z;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`varying vec2 coords;varying float dist;uniform float clock,layer,intensity;
      void main(){float x=coords.x,v=coords.y*2.-1.;float t=clock*.16+layer*2.;
        float bend=.16*sin(x*12.+t)+.07*cos(x*27.-t*.5);
        float e=v-bend,band=exp(-e*e*2.9);
        float filament=exp(-abs(e+.045*sin(x*33.+t*.3))*24.);
        float ends=smoothstep(0.,.12,x)*(1.-smoothstep(.87,1.,x));
        float lamp=pow(.5+.5*cos((x-.64)*8.+.5*sin(t)),4.);
        float warm=smoothstep(.38,.77,x+.10*cos(t));
        vec3 ink=mix(vec3(.38,.55,.68),vec3(.89,.61,.35),warm);
        vec3 light=ink*(.18*band+.36*filament*lamp);
        float fade=ends*intensity*smoothstep(.08,2.6,dist)*(1.-smoothstep(.65,1.,abs(v)));
        gl_FragColor=vec4(light,fade*(.32+.58*lamp)*mix(1.,.48,layer));}`,
      side:T.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending})
    const m=new T.Mesh(geo,mat);group.add(m)
  }
  let seed=0x770d82
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
  const p:number[]=[],a:number[]=[]
  for(let i=0;i<1650;i++){
    const j=i%2,x=(rand()+rand()-1)*14,at=centre(x,j),s=rand()-.5,u=rand()-.5
    p.push(at.x,at.y+s*(2.2+rand()),at.z+u*6)
    a.push(rand(),rand(),rand())
  }
  // Streaks of sediment straddle the camera rail between the two physical
  // thresholds. The lens grazes the first bank at z≈7, then passes the second
  // at z≈1; their apparent size increases with depth, not scroll position.
  for(let i=0;i<7500;i++){
    const t=rand(), side=i%2===0?-1:1, z=11.1-23*t
    const sweep=Math.sin(t*4.7+.08),edgy=(rand()+rand()+rand()-1.5)
    const x=-1.6-1.21*sweep+side*(.94+.83*Math.sin(t*8.5+.55))+edgy*(.85+.78*t)
    const y=.62+.67*Math.cos(t*7.6+side*.90)+side*.48*Math.sin(t*6.3)-edgy*.44+(rand()+rand()-1)*(.57+.56*t)
    p.push(x,y,z+.40*(rand()-.5))
    a.push(rand()**1.3,rand(),rand()**.70)
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('variation',new T.Float32BufferAttribute(a,3))
  const mat=new T.ShaderMaterial({name:'Z30SilverEmulsion',uniforms:{clock,intensity,height},
    vertexShader:`attribute vec3 variation;varying vec3 v;varying float amp;uniform float clock,intensity,height;
    void main(){v=variation;vec3 s=position+vec3(sin(clock*.2+v.x*19.),cos(clock*.21+v.z*22.),sin(clock*.17+v.y*15.))*.10;
      vec4 p=modelViewMatrix*vec4(s,1.);float d=-p.z;
      amp=intensity*(.14+.89*pow(v.z,2.))*(.50+.50*pow(.5+.5*cos(s.x*.65+s.z*.29+clock*.45+v.y*1.3),2.))*smoothstep(.17,1.25,d);
      gl_Position=projectionMatrix*p;gl_PointSize=clamp((.009+.042*pow(v.x,4.))*height/max(d,.5),1.,23.);}`,
    fragmentShader:`varying vec3 v;varying float amp;void main(){vec2 q=2.*gl_PointCoord-1.;float r=dot(q,q);if(r>.99)discard;
      float soft=exp(-r*4.2);vec3 col=mix(vec3(.47,.70,.85),vec3(1.,.72,.42),v.y);
      float facet=exp(-16.*dot(q+vec2(.15,.21),q+vec2(.15,.21)));
      gl_FragColor=vec4(col+facet*.23,amp*soft*(1.-smoothstep(.6,1.,r)));}`,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending})
  group.add(new T.Points(g,mat))
  return (t:number,p:number,h:number)=>{
    group.visible=p<.34
    if(group.visible){clock.value=t;intensity.value=1-T.MathUtils.smoothstep(p,.17,.34);height.value=h}
  }
}
