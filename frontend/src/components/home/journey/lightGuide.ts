import * as T from 'three'
import { opticalLine, bondDistance, apertureDistance, lineLength, beamDistance, pointOnBeam } from './opticalFlight'
import { flightRadiance, turnedMetal } from './worldMaterials'

/** One continuous tube of light from the inlet to the receiving screen. Ring
 * normals are surveyed from the same tangent as the tracking camera. */
export function makeLightGuide(scene:T.Scene){
  const group=new T.Group();group.name='Transmitted branch / measured track';scene.add(group)
  const make=(geo:T.BufferGeometry,mat:T.Material,parent:T.Object3D=group)=>{
    const mesh=new T.Mesh(geo,mat);parent.add(mesh);return mesh
  }
  make(new T.TubeGeometry(opticalLine,460,.012,10,false),flightRadiance(lineLength,false))
  make(new T.TubeGeometry(opticalLine,460,.056,12,false),flightRadiance(lineLength,true))
  const dark=turnedMetal(0x414854,.38),silver=turnedMetal(0x8496a0,.79)
  const up=new T.Vector3(0,1,0),t=new T.Vector3(),r=new T.Vector3(),n=new T.Vector3(),q=new T.Vector3()
  function frame(distance:number){
    opticalLine.getTangentAt(distance/lineLength,t)
    r.crossVectors(t,up).normalize();n.crossVectors(r,t).normalize()
    pointOnBeam(distance,q)
  }
  const guideStart=bondDistance+4.1,guideEnd=apertureDistance-3.15
  // Two tapering edge fibres reveal the bends in perspective without ever
  // enclosing the camera in an opaque pipe.
  for(const side of [-1,1]){
    const pts:T.Vector3[]=[]
    for(let i=0;i<=80;i++){
      const k=i/80;frame(guideStart+(guideEnd-guideStart)*k)
      const twist=.68*Math.sin(k*Math.PI*2-.35),spread=.21+.32*Math.sin(Math.PI*k)
      pts.push(q.clone().addScaledVector(r,side*spread*Math.cos(twist)).addScaledVector(n,side*spread*Math.sin(twist)-.27))
    }
    make(new T.TubeGeometry(new T.CatmullRomCurve3(pts),120,side===1?.013:.019,7,false),side===1?silver:dark)
  }
  // Witness rings supply near-field parallax as the camera rounds the bend:
  // open both ends and leave the central ray and the lens entirely unobstructed.
  for(const [i,k] of [.18,.53,.78].entries()){
    frame(guideStart+(guideEnd-guideStart)*k)
    const g=new T.Group();group.add(g);g.position.copy(q)
    g.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),t)
    const rad=i===1?1.44:1.34
    make(new T.TorusGeometry(rad,.035,9,100,Math.PI*1.54),dark,g).rotation.z=.42+i*.68
    const lip=make(new T.TorusGeometry(rad-.055,.011,6,100,Math.PI*1.08),silver,g)
    lip.rotation.z=.69+i*.68;lip.position.z=.04
  }
  // The photon head is a short luminous caustic, not an opaque sphere.
  const dotMat=new T.ShaderMaterial({name:'Travelling caustic',vertexShader:`
    varying vec3 normalEye,eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);
    normalEye=normalMatrix*normal;eye=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec3 normalEye,eye;void main(){float face=max(0.,dot(normalize(normalEye),normalize(eye)));
    gl_FragColor=vec4(vec3(.79,.93,.99),(.11+.71*face*face)*smoothstep(.16,.85,eye.z));}`,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending})
  const photon=make(new T.SphereGeometry(1,18,12),dotMat);photon.scale.set(.032,.032,.19)
  const axis=new T.Vector3(0,0,1)
  const cloud=new T.BufferGeometry(),pts:number[]=[],vals:number[]=[]
  let seed=61587;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
  for(let i=0;i<2800;i++){
    const d=rand()*lineLength;frame(d)
    const a=rand()*Math.PI*2,spread=.15+Math.pow(rand(),1.6)*1.6
    const pt=q.clone().addScaledVector(r,Math.cos(a)*spread).addScaledVector(n,Math.sin(a)*spread)
    pts.push(...pt.toArray());vals.push(d,rand(),rand())
  }
  cloud.setAttribute('position',new T.Float32BufferAttribute(pts,3));cloud.setAttribute('sampleData',new T.Float32BufferAttribute(vals,3))
  const emulsion=new T.ShaderMaterial({name:'Beam volume / Rayleigh scatter',uniforms:{uPacketMetres:{value:0},height:{value:800}},
    vertexShader:`attribute vec3 sampleData;uniform float uPacketMetres,height;varying vec2 dust;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float delta=sampleData.x-uPacketMetres;
      dust=vec2((.11+.8*exp(-delta*delta*.33))*(.22+.78*sampleData.y),sampleData.z);
      gl_Position=projectionMatrix*mv;gl_PointSize=clamp(height*(.005+.021*sampleData.y)/max(-mv.z,.16),1.,12.);}`,
    fragmentShader:`varying vec2 dust;void main(){vec2 q=2.*gl_PointCoord-1.;float r=dot(q,q);if(r>.95)discard;
      gl_FragColor=vec4(mix(vec3(.39,.68,.83),vec3(.98,.83,.62),dust.y),exp(-3.8*r)*dust.x);}`,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending})
  group.add(new T.Points(cloud,emulsion))
  return (p:number,height:number)=>{
    group.visible=p>.58
    if(!group.visible)return
    const d=Math.min(lineLength,beamDistance(p)+1.23)
    pointOnBeam(d,photon.position);opticalLine.getTangentAt(d/lineLength,t)
    photon.quaternion.setFromUnitVectors(axis,t);emulsion.uniforms.height.value=height
  }
}
