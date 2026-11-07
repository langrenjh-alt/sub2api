import * as T from 'three'
import { alloy, vaporMaterial, relayGuide, quartz, QUARTZ_LAYER } from './worldMaterials'
import { thresholds, sampleArchive, grounding } from './worldAtelier'
import { splitterBench, scanningComparator } from './worldInstruments'

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
    return [Math.sin(t*8+.4)*1.21+Math.cos(twist)*radius*1.36,.4*Math.cos(5*t)+Math.sin(twist)*radius*.92,-6.0-t*36]
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

// Two physical carriers, one measured signal path. Leave the beam splitter's
// working volume empty: it is the beams, not a ribbon through a solid, that
// cross the gap. The second carrier terminates at the iris-side ferrule.
function relayRibbon(parent:T.Group){
  const inlet=line([[2.8,-4.55,-43],[4.2,-3.1,-44.4],[5.1,-1.3,-47],
    [5.35,-1.66,-49.8],[6.25,-1.75,-52.3],[6.46,-1.62,-55.1],[6.52,-2.18,-58.50]])
  const outlet=line([[.03,.84,-62.89],[-.58,.78,-63.82],[-.88,.36,-65.36],
    [.11,-.32,-68.4],[1.58,-1.39,-74.2],[3.45,-.62,-78.5],[4.85,1.69,-82.3],
    [5.13,1.92,-85.1],[5.27,1.13,-87.6],[5.63,.92,-89.7],[5.86,.98,-91.1],
    [5.69,1.02,-92.65],[5.28,1.02,-92.83]])
  const skin=quartz(0x8dc4c0,.94,.60,.20,.60),guide=relayGuide(),back=alloy(0x232429,0x9e9fa6,.97)
  function carry(spine:T.CatmullRomCurve3,rows:number,start:number,end:number){
    const columns=10,frames=spine.computeFrenetFrames(rows,false)
    function stripe(offset:number,width:number,mat:T.Material){
      const positions:number[]=[],uv:number[]=[],indices:number[]=[]
      for(let i=0;i<=rows;i++){
        const local=i/rows,u=start+(end-start)*local,at=spine.getPointAt(local)
        const twist=u*9.3+.41*Math.sin(u*11.4),nx=frames.normals[i],ny=frames.binormals[i]
        const taper=Math.min(1,.23+5.5*local,.23+6*(1-local))
        for(let j=0;j<=columns;j++){
          const f=j/columns*TAU,dx=taper*(offset+width*Math.cos(f)),dy=taper*.032*Math.sin(f)
          const x=dx*Math.cos(twist)-dy*Math.sin(twist),y=dx*Math.sin(twist)+dy*Math.cos(twist)
          positions.push(at.x+x*nx.x+y*ny.x,at.y+x*nx.y+y*ny.y,at.z+x*nx.z+y*ny.z)
          uv.push(u,j/columns)
          if(i<rows&&j<columns){const k=i*(columns+1)+j;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1)}
        }
      }
      const geo=new T.BufferGeometry()
      geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
      geo.setIndex(indices);geo.computeVertexNormals();at(parent,geo,mat)
    }
    stripe(0,.14,skin);stripe(-.135,.019,guide);stripe(.14,.013,back)
  }
  carry(inlet,82,0,.34);carry(outlet,145,.42,1)
}

export function worldForms(scene:T.Scene,dust:T.Material){
  const rand=seeded()
  const groups=[new T.Group(),new T.Group(),new T.Group(),new T.Group()]
  for(const group of groups)scene.add(group)
  estuary(groups[0],dust,rand)
  const stops=new T.Group();groups[0].add(stops);thresholds(stops)
  const column=sampleArchive(groups[1]),setDivider=splitterBench(groups[2])
  const setIris=scanningComparator(groups[3])
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
    const lift=T.MathUtils.smoothstep(p,.12,.215)
    stops.visible=lift>.002;stops.position.y=-8.*(1-lift)
    column.rotation.y=-.19+.15*Math.sin(time*.075)+p*.72
    if(groups[2].visible)setDivider(time,p)
    if(groups[3].visible)setIris(time,p)

  }
}
