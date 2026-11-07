import * as T from 'three'
import { alloy, beamMaterial, vaporMaterial, fibre, quartz, jewelSkin, liquidFloor, QUARTZ_LAYER, WATER_LAYER } from './worldMaterials'

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
  const bank=new Bank(rand), mint:Vec=[.53,.83,.70],blue:Vec=[.43,.65,.92],amber:Vec=[.87,.84,.51]
  const river=(t:number,a:number,spread:number):Vec=>{
    const twist=t*6.8 + a + .42*Math.sin(t*8.2)
    const radius=3.25+.8*Math.sin(t*13+a)*.6+spread
    return [Math.sin(t*8+.4)*1.21+Math.cos(twist)*radius*1.36,.4*Math.cos(5*t)+Math.sin(twist)*radius*.92,12.-t*54]
  }
  // Spatial vapor follows the same river as the grains. The near bank
  // occasionally washes over the lens; broad wisps and pinpoints read as
  // illuminated matter at different focal distances rather than rigid stars.
  const position:number[]=[],corners:number[]=[],radius:number[]=[],color:number[]=[],rotation:number[]=[]
  for(let i=0;i<116;i++){
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
  for(let i=0;i<28000;i++){
    const t=rand(),bankId=rand()>.48?1:0,spread=(rand()+rand()+rand()-1.5)
    const a=bankId*pi + .39*Math.sin(t*22+bankId)+spread*.62
    const [x,y,z]=river(t,a,(rand()+rand()-1)*(.4+rand()*1.35))
    const clump=.45+.55*Math.pow(Math.cos(t*24+a*.5),2)
    bank.add(x,y,z,bankId===0?mint:(rand()>.58?blue:amber),.021+rand()**2.7*.132,clump*(.49+.75*rand()))
  }
  bank.mesh(scene,dust)
  const glint=alloy(0x172522,0x86bdaa,1.15),nickel=alloy(0x112227,0x587987,.87)
  for(let k=0;k<5;k++){
    const nodes:Vec[]=[]
    for(let i=0;i<=39;i++){const t=i/39;nodes.push(river(t,(k%2)*pi+.28*(k-2),-.47+k*.085))}
    tube(scene,line(nodes),k===1?.040:.010+k*.004,k&1?glint:nickel,180)
  }
  // Mineral debris renders in a single draw call.
  instanced(scene,new T.TetrahedronGeometry(1),nickel,235,(o)=>{
    const t=rand(),a=(rand()>.49?pi:0)+(rand()-.5)*1.2
    o.position.set(...river(t,a,(rand()-.45)*1.68));const r=(.012+rand()**4*.112)
    o.scale.set(r*(.35+rand()),r*(.14+rand()*.55),r*(.70+rand()*1.60))
    o.rotation.set(rand()*pi,rand()*pi,rand()*pi)
  })
}

/** A twisted lamellar shard, lofted rather than modeled as a stack of primitives. */
function lamella(turn:number,offset:number) {
  const rows=112,cols=16,positions:number[]=[],indices:number[]=[]
  for(let i=0;i<=rows;i++){
    const t=i/rows,a=turn*t+offset,rad=.69+.32*Math.sin(t*8+.33*offset)
    const taper=.18+.91*Math.pow(Math.sin(Math.PI*t),.78)
    for(let j=0;j<=cols;j++){
      const phi=TAU*j/cols,w=taper*Math.cos(phi),thick=.23*taper*Math.sin(phi)
      positions.push(Math.cos(a)*rad+Math.cos(a*1.31)*w-Math.sin(a*1.31)*thick,
        (t-.5)*10.8+.19*Math.sin(phi)*Math.sin(t*pi),
        Math.sin(a)*rad+Math.sin(a*1.31)*w+Math.cos(a*1.31)*thick)
      if(i<rows&&j<cols){const n=i*(cols+1)+j;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1)}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  g.setIndex(indices);g.computeVertexNormals();return g
}

/** An amethyst archive: layered strata of fractured glass suspended in zero g. */
function archive(scene:T.Group,dust:T.Material,rand:()=>number) {
  const group=new T.Group();group.position.set(2.7,.05,-43);scene.add(group)
  const column=new T.Group();group.add(column)
  const lilac=quartz(0xa579bc,1.08,.86),ice=quartz(0x98d2d7,.82,.68)
  // A dark mineral core is visible both inside the glass and through the
  // gallery panes. Never hide the entire spine during scene-color capture.
  const core=at(column,lamella(6.7,.08),alloy(0x301b37,0x9889ae,1.05))
  core.scale.set(.74,.985,.74)
  const vein=at(column,lamella(6.7,1.82),alloy(0x1c2830,0xbed0c9,1.02))
  vein.scale.set(.62,.965,.62)
  at(column,lamella(6.7,.08),lilac)
  at(column,lamella(6.7,1.82),ice)
  for(let k=0;k<2;k++){
    instanced(column,new T.DodecahedronGeometry(1,0),k?ice:lilac,k?13:22,(o,i)=>{
      const t=i/(k?12:21), a=t*7.0+k*pi
      const r=.7+.62*Math.sin(t*pi)**2
      o.position.set(Math.cos(a)*r+(rand()-.5)*.32,(t-.5)*9+(rand()-.5)*.50,Math.sin(a)*r)
      const s=k?.22+.44*rand():.35+rand()*.52
      o.scale.set(s*(.9+rand()*.8),s*(.49+rand()*.84),s*(.65+rand()*.82))
      o.rotation.set(rand()*pi*.77,rand()*pi,rand()*pi*.62)
    })
  }
  // Three warm metal wires curled around the cut crystal, not additional flat cards.
  for(let k=0;k<3;k++){
    const nodes:Vec[]=[]
    for(let i=0;i<=34;i++){const t=i/34,a=t*7+k*2.09,r=1.9+.42*Math.sin(t*pi);
      nodes.push([Math.cos(a)*r,(t-.5)*8.65,Math.sin(a)*r])}
    tube(column,line(nodes),k===0?.025:.012,k===0?ice:lilac,90)
  }
  const bank=new Bank(rand)
  for(let i=0;i<7700;i++){
    const t=rand(),a=7.3*t+(rand()>.5?pi:0)+(rand()-.5)*.82
    const r=1.72+1.40*rand()+.84*Math.sin(t*pi)
    bank.add(Math.cos(a)*r,(t-.5)*11.5+(rand()-.5)*.88,Math.sin(a)*r,
      rand()>.4?[.74,.42,.88]:[.46,.75,.87],.020+.11*rand()**2,.48+.63*rand())
  }
  bank.mesh(group,dust)
  return column
}

/** Parallel strands split at a transparent junction and continue downrange. */
function conduit(scene:T.Group,dust:T.Material,rand:()=>number) {
  const group=new T.Group(); group.position.set(2.6,-.2,-64);scene.add(group)
  const mint=quartz(0x71dbc4,.75,.94),silver=alloy(0x10202d,0x94b8c1,1.08)
  const signal=fibre(0x55bfa7),cool=fibre(0x72a4bf)
  const node=(t:number,lane:number,offset:number):Vec=>{
    const a=-1.16+4.75*t+(lane?pi:0),r=1.0+1.55*Math.sin(t*pi)**1.4
    return [Math.cos(a)*(r+offset),Math.sin(a)*(.61*r+offset)+.15*Math.sin(5*t),7.-t*16.]
  }
  for(let lane=0;lane<2;lane++)
    for(let f=0;f<5;f++){
      const offsets=(f-2)*.16, coords:Vec[]=[]
      for(let i=0;i<=28;i++)coords.push(node(i/28,lane,offsets))
      const curve=line(coords)
      tube(group,curve,f===2?.065:.014,f===2?mint:(lane?silver:signal),110)
      if(f===2)tube(group,curve,.032,lane?cool:signal,110)
    }
  const bank=new Bank(rand)
  for(let i=0;i<6600;i++){
    const t=rand(),l=i%2,p=node(t,l,(rand()-.5)*1.25)
    bank.add(p[0]+(rand()-.5)*.65,p[1]+(rand()-.5)*.56,p[2],
      l?[.44,.70,.89]:[.41,.98,.75],.017+.094*rand()**2,.46+.80*rand())
  }
  bank.mesh(group,dust)
  // Off-axis beam splitter appears below the receding archival pane before
  // the camera reaches the main junction. Its rim is deliberately incomplete.
  const splitter=new T.Group();splitter.position.set(2.37,-.47,5.65)
  splitter.rotation.set(-.22,.69,.44);group.add(splitter)
  const lens=at(splitter,new T.SphereGeometry(1,48,26),quartz(0x9fcfcd,.94,1.0))
  lens.scale.set(1.52,.83,.17)
  for(let j=0;j<2;j++){
    const rr:Vec[]=[]
    for(let i=0;i<=23;i++){
      const a=.5+j*pi+i/23*1.89
      rr.push([1.54*Math.cos(a),.84*Math.sin(a),.02])
    }
    tube(splitter,line(rr),.018,j?cool:signal,48)
  }
  // A triangular prism divides the streams; use chamfered rings to separate
  // its facets from the stream, as in a physical optical instrument.
  const prism=at(group,new T.OctahedronGeometry(1.17),mint,0,.03,-1.2)
  prism.scale.set(.93,1.38,.69)
  const kernel=at(prism,new T.OctahedronGeometry(.69),cool)
  kernel.rotation.set(.16,.51,.09)
  for(let k=0;k<6;k++){
    const t=.24+k*.10,p=node(t,k%2,0)
    const hoop=at(group,new T.TorusGeometry(.52,.023,7,54),silver,...p)
    hoop.rotation.set(-.2+t*.38,.46*Math.sin(t*5),.23)
  }
  return prism
}

function observatory(scene:T.Group,coreDust:T.Material,rand:()=>number) {
  const frame=new T.Group();frame.position.set(2.15,0,-93);scene.add(frame)
  const steel=alloy(0x222533,0x9f9bba,.93),quartz=alloy(0x2c273b,0xc0adc9,1.24),black=alloy(0x12161c,0x505765,.64)
  const torus=(r:number,t:number,y:number,mat:T.Material,arc=TAU)=>{
    const ring=at(frame,new T.TorusGeometry(r,t,9,104,arc),mat,0,y,0)
    ring.rotation.x=pi/2;return ring
  }
  for(const [r,t,y] of [[3.04,.14,-2.64],[2.88,.044,-2.42],[2.65,.03,-2.3],[3.12,.15,2.97],[2.80,.06,2.72],[3.32,.036,3.25]]){
    torus(r,t,y,steel)
  }
  const crown=torus(3.04,.075,2.55,quartz,pi*1.6)
  const base=at(frame,new T.CylinderGeometry(3.04,3.74,.48,80),black,0,-2.94,0);base.rotation.y=.4
  at(frame,new T.CylinderGeometry(2.54,2.82,.19,80),steel,0,-2.57,0)
  for(let i=0;i<7;i++){
    const a=i*TAU/7+.16,x=2.95*Math.cos(a),z=2.95*Math.sin(a)
    tube(frame,line([[x,-2.57,z],[x*.96,-1.78,z*.96],[x*.96,1.83,z*.96],[x,2.92,z]]),.038,i&1?black:steel,25)
    // Fine hanging cables disappear into the ceiling above the apparatus.
    tube(frame,line([[x*.97,2.78,z*.97],[x*1.36,4.1,z*1.2],[x*2.16,6.4,z*1.68],[x*2.9,7.65,z*2.28]]),.018,black,42)
  }
  // Replicated stator teeth form a slotted optical collar under the crown.
  instanced(frame,new T.BoxGeometry(1,1,1),steel,72,(o,i)=>{
    const a=i*TAU/72;o.position.set(3.04*Math.cos(a),2.965,3.04*Math.sin(a))
    o.scale.set(.16,.21,.04);o.rotation.set(0,-a,0)
  })
  for(let i=0;i<12;i++){
    const a=TAU*i/12
    const ring=torus(3.08,.022,-2.69+i*.016,steel,TAU*.32)
    ring.rotation.z=a
  }
  const kernel=new T.Group();frame.add(kernel)
  const bank=new Bank(rand)
  for(let i=0;i<5100;i++){
    const a=TAU*rand(),b=TAU*rand()
    const centre=.895+.11*Math.sin(a*3.0+.45)
    const r=.34+.11*Math.cos(4*a)+.19*(rand()-.48)
    const span=centre+r*Math.cos(b)
    const near=.48+.52*Math.max(0,Math.sin(a+.38))
    bank.add(span*Math.cos(a),span*Math.sin(a)*1.16+.10,r*Math.sin(b)+.21*Math.sin(2*a+.25),
      rand()>.72?[.96,.90,.79]:rand()>.46?[.70,.59,.88]:[.53,.82,.89],
      .023+.084*rand()**2,(.59+.70*rand())*near)
  }
  bank.mesh(kernel,coreDust)
  const skin=new T.TorusGeometry(.89,.23,18,112)
  const body=skin.getAttribute('position')
  for(let i=0;i<body.count;i++){
    const x=body.getX(i),y=body.getY(i),z=body.getZ(i),a=Math.atan2(y,x)
    const span=1+.11*Math.sin(a*3+.45)
    body.setXYZ(i,x*span,y*span*1.16+.1,z+.21*Math.sin(a*2+.25))
  }
  skin.computeVertexNormals();at(kernel,skin,jewelSkin())
  instanced(kernel,new T.TetrahedronGeometry(1),quartz,124,o=>{
    const a=rand()*TAU,b=rand()*TAU,r=.845+.33*Math.cos(b)
    o.position.set(r*Math.cos(a),r*Math.sin(a)*1.16,.32*Math.sin(b)+.18*Math.sin(2*a))
    const sc=.019+.09*rand()**2;o.scale.set(sc*.75,sc*(.73+rand()),sc*.63)
    o.rotation.set(rand()*pi,rand()*pi,rand()*pi)
  })
  // Layered rock shelf: large fragments in silhouette, small faceted scree picking up the crown.
  const reef=new T.IcosahedronGeometry(1,1)
  const vertices=reef.getAttribute('position')
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i)
    const r=.77+.19*Math.sin(x*7+z*2)*Math.cos(y*6-z*3)+.13*Math.sin(x*2+y*8)
    vertices.setXYZ(i,x*r,y*r,z*r)
  }
  reef.computeVertexNormals()
  const bedrock=alloy(0x14171b,0x393946,.35)
  instanced(frame,reef,bedrock,310,o=>{
    const a=TAU*rand(),r=3.0+rand()**1.6*9.5,sc=.15+rand()**2*1.32
    o.position.set(Math.cos(a)*r,-3.25-.10*r+(rand()-.5)*.3,Math.sin(a)*r)
    o.scale.set(sc*(1+rand()),sc*.31,sc);o.rotation.set(.1*rand(),rand()*TAU,.12*(rand()-.5))
  })
  for(let i=0;i<4;i++){
    const shaft=at(frame,new T.PlaneGeometry(1.4+i*.43,8.6),beamMaterial(i&1?0x99c6d7:0xbb9cda),-.82+i*.64,1.8,-1.2+.13*i)
    shaft.rotation.z=-.15+.055*i
  }
  const basin=at(frame,new T.PlaneGeometry(51,48),liquidFloor(),0,-3.24,-1.4)
  basin.rotation.x=-pi/2;basin.layers.set(WATER_LAYER)
  return {kernel,crown}
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

export function worldForms(scene:T.Scene,dust:T.Material,coreDust:T.Material){
  const rand=seeded()
  const groups=[new T.Group(),new T.Group(),new T.Group(),new T.Group()]
  for(const group of groups)scene.add(group)
  estuary(groups[0],dust,rand)
  const column=archive(groups[1],dust,rand),prism=conduit(groups[2],dust,rand)
  const {kernel,crown}=observatory(groups[3],coreDust,rand)
  const relay=new T.Group();scene.add(relay);relayRibbon(relay)
  scene.traverse(obj=>{
    const mat=(obj as T.Mesh).material
    if(mat instanceof T.ShaderMaterial&&mat.userData.quartz)obj.layers.set(QUARTZ_LAYER)
  })
  return (time:number,p:number)=>{
    groups[0].visible=p<.58;groups[1].visible=p>.21&&p<.68
    groups[2].visible=p>.43&&p<.875;groups[3].visible=p>.695
    relay.visible=p>.245
    column.rotation.y=.42*Math.sin(time*.072)+p*.88
    prism.rotation.y=.47+time*.071
    kernel.rotation.set(.25+.10*Math.sin(time*.14),.22+.48*Math.sin(time*.17+p),.25+.15*Math.sin(time*.11))
    kernel.position.y=.10+.087*Math.sin(time*.64)
    crown.rotation.z=Math.sin(time*.105)*.22+p*.42
  }
}
