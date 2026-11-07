import * as T from 'three'
import { alloy, vaporMaterial, fibre, quartz, QUARTZ_LAYER } from './worldMaterials'
import { thresholds, entranceLeaf, sampleArchive, beamDivider, comparator, grounding, indexSector } from './worldAtelier'

const pi=Math.PI,TAU=pi*2
type Vec=[number,number,number]
const point=(x:number,y:number,z:number)=>new T.Vector3(x,y,z)
const line=(coords:Vec[])=>new T.CatmullRomCurve3(coords.map(p=>point(...p)))
function tube(parent:T.Object3D, curve:T.Curve<T.Vector3>, width:number, mat:T.Material, length=96, sides=6) {
  const mesh=new T.Mesh(new T.TubeGeometry(curve,length,width,sides,false),mat)
  parent.add(mesh); return mesh
}
function at(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0) {
  const m=new T.Mesh(geo,mat); m.position.set(x,y,z);parent.add(m);return m
}
function seeded(seed=301) {
  return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
}
function instanced(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material,count:number,place:(o:T.Object3D,i:number)=>void) {
  const batch=new T.InstancedMesh(geometry,material,count),dummy=new T.Object3D()
  for(let i=0;i<count;i++){place(dummy,i);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix)}
  batch.computeBoundingSphere();parent.add(batch);return batch
}

class Bank {
  p:number[]=[]; c:number[]=[]; size:number[]=[]; phase:number[]=[]
  constructor(private rand:()=>number){}
  add(x:number,y:number,z:number,ink:Vec,size:number,amp=1){
    this.p.push(x,y,z);this.c.push(ink[0]*amp,ink[1]*amp,ink[2]*amp)
    this.size.push(size);this.phase.push(this.rand()*TAU)
  }
  mesh(parent:T.Object3D,material:T.Material) {
    const g=new T.BufferGeometry()
    for(const [key,values,n] of [['position',this.p,3],['hue',this.c,3],['size',this.size,1],['phase',this.phase,1]] as const)
      g.setAttribute(key,new T.Float32BufferAttribute(values,n))
    g.computeBoundingSphere();const cloud=new T.Points(g,material);parent.add(cloud);return cloud
  }
}

/** A river of shoals and torn seams, with openings the camera actually passes through. */
function estuary(scene:T.Group,dust:T.Material,rand:()=>number) {
  const bank=new Bank(rand), mint:Vec=[.65,.78,.71],blue:Vec=[.46,.57,.66],amber:Vec=[.75,.69,.53]
  const river=(t:number,a:number,spread:number):Vec=>{
    const twist=t*6.8 + a + .42*Math.sin(t*8.2)
    const radius=3.25+.8*Math.sin(t*13+a)*.6+spread
    return [Math.sin(t*8+.4)*1.21+Math.cos(twist)*radius*1.36,.4*Math.cos(5*t)+Math.sin(twist)*radius*.92,12.-t*54]
  }
  // Spatial vapor follows the same river as the grains. The near bank
  // occasionally washes over the lens; broad wisps and pinpoints read as
  // illuminated matter at different focal distances rather than rigid stars.
  const position:number[]=[],corners:number[]=[],radius:number[]=[],color:number[]=[],rotation:number[]=[]
  for(let i=0;i<65;i++){
    const t=rand(),side=rand()>.5?0:1
    const xyz=river(t,side*pi+(rand()-.5)*.87,(rand()-.55)*1.40)
    const scale=1.2+rand()**1.3*2.7,alpha=.23+rand()*.55
    const c=side?blue:mint,tilt=(rand()-.5)*2.0
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
      position.push(...xyz);corners.push(x,y);radius.push(scale,scale*.56)
      color.push(...c.map(v=>v*alpha));rotation.push(tilt)
    }
  }
  const vapor=new T.BufferGeometry()
  for(const [key,data,size] of [['position',position,3],['corner',corners,2],['radius',radius,2],['ink',color,3],['tilt',rotation,1]] as const)
    vapor.setAttribute(key,new T.Float32BufferAttribute(data,size))
  scene.add(new T.Mesh(vapor,vaporMaterial()))
  // Irregular clumps orbit opposite banks; stochastic sizes mix silt, grains
  // and reflective boulders. Intentionally no uniform screen-space star field.
  for(let i=0;i<11800;i++){
    const t=rand(),bankId=rand()>.48?1:0,spread=(rand()+rand()+rand()-1.5)
    const a=bankId*pi + .39*Math.sin(t*22+bankId)+spread*.48
    const [x,y,z]=river(t,a,(rand()+rand()-1)*(.27+rand()*1.02))
    const clump=.45+.55*Math.pow(Math.cos(t*24+a*.5),2)
    bank.add(x,y,z,bankId===0?mint:(rand()>.58?blue:amber),.012+rand()**3.4*.069,clump*(.41+.65*rand()))
  }
  bank.mesh(scene,dust)
  const glint=alloy(0x172522,0x9aaca1,1.15),nickel=alloy(0x112227,0x587987,.87)
  for(let k=0;k<3;k++){
    const nodes:Vec[]=[]
    for(let i=0;i<=39;i++){const t=i/39;nodes.push(river(t,(k%2)*pi+.28*(k-2),-.47+k*.085))}
    tube(scene,line(nodes),k===1?.040:.010+k*.004,k&1?glint:nickel,180)
  }
  // Mineral debris renders in a single draw call.
  instanced(scene,new T.TetrahedronGeometry(1),nickel,74,(o)=>{
    const t=rand(),a=(rand()>.49?pi:0)+(rand()-.5)*1.2
    o.position.set(...river(t,a,(rand()-.45)*1.68));const r=(.012+rand()**4*.112)
    o.scale.set(r*(.35+rand()),r*(.14+rand()*.55),r*(.70+rand()*1.60))
    o.rotation.set(rand()*pi,rand()*pi,rand()*pi)
  })
}

// The archive unwinds into one continuous strip, passing through the data
// conduit and grazing the observatory basin before it disappears under water.
function relayRibbon(parent:T.Group){
  const spine=line([[2.8,-4.55,-43.0],[4.2,-3.1,-44.4],[5.1,-1.3,-47.0],
    [5.35,-1.66,-49.8],[6.15,-1.70,-52.3],[5.35,-1.60,-55.3],
    [4.60,-1.30,-57.4],[4.10,-.60,-60.8],[3.80,.56,-63.1],
    [2.33,1.23,-66.7],[.73,-.1,-70.3],[1.6,-1.63,-74.3],
    [3.46,-.62,-78.5],[4.85,1.69,-82.3],[5.13,1.92,-85.1],
    [4.73,.76,-87.5],[4.12,-1.61,-89.7],[3.7,-3.21,-92.4]])
  const rows=230,columns=12,positions:number[]=[],uv:number[]=[],indices:number[]=[]
  const frames=spine.computeFrenetFrames(rows,false)
  const strand=(offset:number,width:number)=>{
    positions.length=uv.length=indices.length=0
    for(let i=0;i<=rows;i++){
      const t=i/rows,at=spine.getPointAt(t),twist=t*9.3+.41*Math.sin(t*11.4)
      const nx=frames.normals[i],ny=frames.binormals[i]
      const scale=Math.min(1,.10+7*t,.10+9*(1-t))
      for(let j=0;j<=columns;j++){
        const f=j/columns*TAU,dx=scale*(offset+width*Math.cos(f)),dy=scale*.034*Math.sin(f)
        const a=dx*Math.cos(twist)-dy*Math.sin(twist),b=dx*Math.sin(twist)+dy*Math.cos(twist)
        positions.push(at.x+a*nx.x+b*ny.x,at.y+a*nx.y+b*ny.y,at.z+a*nx.z+b*ny.z)
        uv.push(t,j/columns)
        if(i<rows&&j<columns){const k=i*(columns+1)+j;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1)}
      }
    }
    const geo=new T.BufferGeometry()
    geo.setAttribute('position',new T.Float32BufferAttribute(positions,3))
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo
  }
  at(parent,strand(0,.19),quartz(0x8dc4c0,1.04,.92,.7))
  at(parent,strand(-.18,.021),fibre(0xb3d2c4))
  at(parent,strand(.19,.017),alloy(0x292330,0xc6aabb,1.09))
}

export function worldForms(scene:T.Scene,dust:T.Material){
  const rand=seeded()
  const groups=[new T.Group(),new T.Group(),new T.Group(),new T.Group()]
  for(const group of groups)scene.add(group)
  estuary(groups[0],dust,rand);thresholds(groups[0]);entranceLeaf(groups[0])
  const column=sampleArchive(groups[1]),prism=beamDivider(groups[2])
  const {head,lensRig}=comparator(groups[3]);indexSector(head)
  const floor=new T.Group();scene.add(floor);grounding(floor)
  const relay=new T.Group();scene.add(relay);relayRibbon(relay)
  scene.traverse(obj=>{
    const mat=(obj as T.Mesh).material
    if(mat instanceof T.ShaderMaterial&&mat.userData.quartz)obj.layers.set(QUARTZ_LAYER)
  })
  return (time:number,p:number)=>{
    groups[0].visible=p<.58;groups[1].visible=p>.21&&p<.68
    groups[2].visible=p>.43&&p<.875;groups[3].visible=p>.695
    relay.visible=p>.245
    floor.visible=p<.85
    column.rotation.y=-.19+.15*Math.sin(time*.075)+p*.72
    prism.rotation.y=-.34+.085*Math.sin(time*.085)
    head.rotation.set(.18+.065*Math.sin(time*.13),-.56+.19*Math.sin(time*.12+p),-.25)
    lensRig.rotation.y=-.12+.28*Math.sin(time*.16+p)
    lensRig.position.x=.28+.12*Math.sin(time*.18)

  }
}
