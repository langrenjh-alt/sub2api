import * as T from 'three'
import { alloy, quartz, benchMaterial, QUARTZ_LAYER } from './worldMaterials'

type Pair=readonly [number,number]
type XYZ=[number,number,number]
const P=Math.PI
const tau=P*2
export function obj(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){
  const o=new T.Mesh(g,m);o.position.set(x,y,z)
  if(m.userData.quartz)o.layers.set(QUARTZ_LAYER)
  parent.add(o);return o
}
export function block(parent:T.Object3D,mat:T.Material,dim:XYZ,at:XYZ) {
  return obj(parent,new T.BoxGeometry(...dim),mat,...at)
}
export function cast(points:Pair[],thickness:number,bevel=.04,holes:T.Path[]=[]){
  const shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)))
  shape.closePath();shape.holes.push(...holes)
  const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:bevel>0,
    bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,curveSegments:36})
  return g.translate(0,0,-thickness*.5)
}
export function bore(x:number,y:number,rx:number,ry:number,angle=0){
  const path=new T.Path();path.absellipse(x,y,rx,ry,0,tau,true,angle);return path
}
export function rail(p:T.Object3D,keys:XYZ[],r:number,mat:T.Material,ns=55){
  const c=new T.CatmullRomCurve3(keys.map(v=>new T.Vector3(...v)))
  return obj(p,new T.TubeGeometry(c,ns,r,5,false),mat)
}
export function pin(p:T.Object3D,m:T.Material,r:number,thick:number,x:number,y:number,z:number){
  const o=obj(p,new T.CylinderGeometry(r,r,thick,28),m,x,y,z);o.rotation.x=P/2;return o
}
export function ring(p:T.Object3D,m:T.Material,r:number,t:number,x:number,y:number,z:number,arc=tau){
  return obj(p,new T.TorusGeometry(r,t,6,80,arc),m,x,y,z)
}
export function placeBatch(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,n:number,set:(o:T.Object3D,i:number)=>void){
  const inst=new T.InstancedMesh(g,m,n),d=new T.Object3D()
  for(let i=0;i<n;i++){set(d,i);d.updateMatrix();inst.setMatrixAt(i,d.matrix)}
  inst.computeBoundingSphere();parent.add(inst)
}

// A single casting profile with a reverse shoulder. None of the instruments
// need labels to explain their function: light passes through actual voids.


/** Approach: the camera passes three tall knife-edge light stops, not a star tunnel. */
export function thresholds(parent:T.Group){
  const shell=alloy(0x1d2425,0x849592,.88),edge=alloy(0x302e2b,0xc5aa91,1.14)
  const glazing=quartz(0xb5c6be,.75,.54)
  const profile:Pair[]=[[.05,-3.90],[1.47,-3.79],[1.44,-2.42],[1.17,-.89],[.73,.89],
    [-.13,2.32],[-1.25,3.53],[-2.48,4.12],[-2.65,4.08],[-1.37,2.93],
    [-.50,1.59],[.04,.03],[.20,-1.76]]
  const blank=cast(profile,.48,.055),edgeBlank=cast(profile,.045,.014)
  for(let i=1;i<3;i++){
    const unit=new T.Group(),side=i===1?-1:1
    unit.position.set(side*(3.70-i*.14),-.87+i*.14,2-i*13)
    unit.rotation.set(.04*i,side*(-.49+i*.15),side*(-.28+i*.135));parent.add(unit)
    unit.scale.y=i===0?1.09:i===1?.91:1.20
    unit.scale.x=side
    obj(unit,blank,shell)
    const leaf=obj(unit,edgeBlank,glazing,-.19,.08,.48)
    leaf.rotation.y=-.19
    // The gap, not a glowing perimeter, carries light around the blind.
    rail(unit,[[-2.47,4.12,.268],[-1.25,3.51,.268],[-.12,2.31,.268],[.72,.89,.268]],.019,edge)
    block(unit,shell,[1.91,.22,1.18],[.36,-4.04,0])
  }
}

/** Archive: a suspended stack of optical sample wafers held on a single dark spine. */
export function sampleArchive(parent:T.Group){
  const rig=new T.Group();rig.position.set(2.7,.05,-43);parent.add(rig)
  const smoked=quartz(0xa79caf,1.08,.62),clear=quartz(0xb9c6c2,.86,.64)
  const nickel=alloy(0x272529,0xac9b97,1.08),chassis=alloy(0x202024,0x756f79,.75)
  const carrier=cast([[-.38,-5.40],[.05,-5.40],[.38,-2.8],[.58,2.85],[.43,5.60],[.08,5.57],[-.20,1.16]],.46,.068)
  obj(rig,carrier,chassis,-.2,0,-.45)
  const sample=cast([[-1.44,-.40],[-1.26,-.76],[.10,-.82],[1.56,-.44],[1.73,-.11],
    [1.43,.33],[.30,.64],[-.94,.58],[-1.45,.22]],.62,.092)
  for(let i=0;i<6;i++){
    const y=-3.39+i*1.36,a=-.41+.12*i
    const wafer=new T.Group();wafer.position.set(.18*Math.sin(i*.82),y,0)
    wafer.rotation.set(.16*Math.sin(i*.6),a,-.27+.045*i);rig.add(wafer)
    obj(wafer,sample,i===1||i===4?smoked:clear)
    // A metal key is visible THROUGH the transmissive sample; leave air on both sides.
    block(wafer,nickel,[1.24,.070,.20],[-.30,-.54,-.24])
    pin(wafer,chassis,.12,.20,-.79,-.03,.27)
  }
  return rig
}

export function grounding(parent:T.Group){
  const floor=obj(parent,new T.PlaneGeometry(52,106),benchMaterial(),0,-4.65,-32)
  floor.rotation.x=-P/2
  // Low receding threshold slits in the wall. Sparse, deliberately off-centre.
  const wall=alloy(0x202326,0x676a6d,.53)
  for(let i=0;i<3;i++) {
    const pier=block(parent,wall,[.82,9.3,2.55],[8.7+i*.44,.05,-20.8-i*19.0])
    pier.rotation.y=-.30
  }
}
