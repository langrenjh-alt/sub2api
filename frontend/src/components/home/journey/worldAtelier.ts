import * as T from 'three'
import { alloy, quartz, fibre, benchMaterial, ruledFace, comparatorTarget, WATER_LAYER, QUARTZ_LAYER, liquidFloor } from './worldMaterials'

type Pair=readonly [number,number]
type XYZ=[number,number,number]
const P=Math.PI
const tau=P*2
function obj(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){
  const o=new T.Mesh(g,m);o.position.set(x,y,z)
  if(m.userData.quartz)o.layers.set(QUARTZ_LAYER)
  parent.add(o);return o
}
function block(parent:T.Object3D,mat:T.Material,dim:XYZ,at:XYZ) {
  return obj(parent,new T.BoxGeometry(...dim),mat,...at)
}
function cast(points:Pair[],thickness:number,bevel=.04,holes:T.Path[]=[]){
  const shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)))
  shape.closePath();shape.holes.push(...holes)
  const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:bevel>0,
    bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,curveSegments:36})
  return g.translate(0,0,-thickness*.5)
}
function bore(x:number,y:number,rx:number,ry:number,angle=0){
  const path=new T.Path();path.absellipse(x,y,rx,ry,0,tau,true,angle);return path
}
function rail(p:T.Object3D,keys:XYZ[],r:number,mat:T.Material,ns=55){
  const c=new T.CatmullRomCurve3(keys.map(v=>new T.Vector3(...v)))
  return obj(p,new T.TubeGeometry(c,ns,r,5,false),mat)
}
function pin(p:T.Object3D,m:T.Material,r:number,thick:number,x:number,y:number,z:number){
  const o=obj(p,new T.CylinderGeometry(r,r,thick,28),m,x,y,z);o.rotation.x=P/2;return o
}
function ring(p:T.Object3D,m:T.Material,r:number,t:number,x:number,y:number,z:number,arc=tau){
  return obj(p,new T.TorusGeometry(r,t,6,80,arc),m,x,y,z)
}
function placeBatch(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,n:number,set:(o:T.Object3D,i:number)=>void){
  const inst=new T.InstancedMesh(g,m,n),d=new T.Object3D()
  for(let i=0;i<n;i++){set(d,i);d.updateMatrix();inst.setMatrixAt(i,d.matrix)}
  inst.computeBoundingSphere();parent.add(inst)
}

// A single casting profile with a reverse shoulder. None of the instruments
// need labels to explain their function: light passes through actual voids.
const shoulder:Pair[]=[[-1.73,-1.16],[-1.72,-.37],[-1.40,.96],[-.63,1.60],
  [-.26,1.73],[.50,1.56],[1.30,.79],[1.69,-.47],[1.50,-1.08],
  [.70,-1.43],[-1.14,-1.47]]

/** Approach: the camera passes three tall knife-edge light stops, not a star tunnel. */
export function thresholds(parent:T.Group){
  const shell=alloy(0x1d2425,0x849592,.88),edge=alloy(0x302e2b,0xc5aa91,1.14)
  const glazing=quartz(0xb5c6be,.75,.54)
  const profile:Pair[]=[[.05,-3.90],[1.47,-3.79],[1.44,-2.42],[1.17,-.89],[.73,.89],
    [-.13,2.32],[-1.25,3.53],[-2.48,4.12],[-2.65,4.08],[-1.37,2.93],
    [-.50,1.59],[.04,.03],[.20,-1.76]]
  const blank=cast(profile,.48,.055),edgeBlank=cast(profile,.045,.014)
  for(let i=0;i<3;i++){
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

/** One broad, tapered optical leaf reaches back from the first light stop.
 * A refracting face and a metal lip follow the SAME curve across the cut;
 * nothing wraps around the title or needs an outline to be understood. */
export function entranceLeaf(parent:T.Group){
  const spine=new T.CatmullRomCurve3([[6.1,2.55,13.],[3.87,2.34,8.],
    [2.28,1.61,3.7],[2.04,.76,-.9],[2.93,.52,-4.4],[4.38,1.03,-9.3],
    [3.95,1.72,-14.],[2.56,2.34,-19.8],[2.93,2.91,-23.6]].map(v=>new T.Vector3(...v as XYZ)))
  const rows=126,cols=14,f=spine.computeFrenetFrames(rows,false)
  const band=(width:number,offset:number,thickness:number)=>{
    const g=new T.BufferGeometry(),verts:number[]=[],indices:number[]=[],uv:number[]=[]
    for(let i=0;i<=rows;i++){
      const t=i/rows,c=spine.getPointAt(t),a=1.04+1.68*Math.sin(t*6.2)
      const fade=.20+.80*Math.sin(t*P)**.60
      for(let j=0;j<=cols;j++){
        const b=j/cols*tau,w=fade*(offset+width*Math.cos(b)),h=thickness*Math.sin(b)*fade
        const dx=w*Math.cos(a)-h*Math.sin(a),dy=w*Math.sin(a)+h*Math.cos(a)
        verts.push(c.x+dx*f.normals[i].x+dy*f.binormals[i].x,c.y+dx*f.normals[i].y+dy*f.binormals[i].y,
          c.z+dx*f.normals[i].z+dy*f.binormals[i].z)
        uv.push(t,j/cols)
        if(i<rows&&j<cols){const k=i*(cols+1)+j;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1)}
      }
    }
    g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
    g.setIndex(indices);g.computeVertexNormals();return g
  }
  obj(parent,band(.77,0,.068),quartz(0xbfcdd3,1.12,.71))
  obj(parent,band(.031,.745,.040),alloy(0x2e3030,0xbeada5,1.13))
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

/** API chapter: a polished beam divider mounted on a real optical bench. */
export function beamDivider(parent:T.Group){
  const mount=new T.Group();mount.position.set(3.16,-.30,-62.8);parent.add(mount)
  const glass=quartz(0xbfd2c6,1.18,.72),bronze=alloy(0x39322e,0xc5a98b,1.09)
  const black=alloy(0x24282a,0x859294,.79),cool=fibre(0xb9cdc4),warm=fibre(0xc1a087)
  const head=new T.Group();head.scale.setScalar(1.18);head.position.set(.1,.61,-.24)
  head.rotation.set(.065,-.27,-.115);mount.add(head)
  const right=cast([[-.24,-1.81],[.39,-1.84],[2.00,1.06],[1.80,1.62],[.99,1.86],[.40,1.26]],.85,.085)
  const left=cast([[-1.42,1.52],[-1.66,.87],[-.62,-1.78],[-.26,-1.79],[-.19,-.47],[-.61,1.21]],.64,.072)
  obj(head,right,glass);obj(head,left,quartz(0x94afbe,1.01,.64),-.11,.055,.20)
  const back=obj(head,right,black,.31,-.55,-.62);back.scale.set(.58,.57,.31)
  rail(head,[[.24,-1.67,-.26],[.80,-.50,-.26],[1.36,.64,-.26]],.029,bronze)
  for(const x of [-.82,1.57])pin(head,bronze,.108,.27,x,x<0?.96:1.03,-.08)
  // Exposed bevel and narrow retaining shoe: asymmetry gives the pair an identifiable profile.
  rail(head,[[.46,1.31,.52],[.98,1.90,.52],[1.75,1.64,.52]],.023,bronze,22)
  block(head,bronze,[1.38,.26,1.14],[0,-1.87,-.05])
  for(let i=0;i<3;i++)pin(head,bronze,.055,.11,-.51+i*.48,-1.86,.55)
  block(mount,black,[1.11,1.82,1.02],[.13,-2.28,-.30])
  const sole=obj(mount,cast([[-2.31,-.38],[-1.97,-.70],[1.53,-.70],[2.29,-.18],[2.07,.56],[-1.55,.62]],.27,.055),black,.24,-3.30,-.20)
  sole.rotation.x=-P/2
  // One incoming ray and two outgoing paths. Each diverges from the same air slot.
  rail(mount,[[3.69,-2.18,8.9],[2.23,-.95,5.3],[.67,.12,1.14],[.03,.37,0]],.027,cool)
  rail(mount,[[.03,.37,0],[.97,.76,-1.7],[2.43,1.38,-3.88],[3.66,1.42,-6.32]],.023,cool)
  rail(mount,[[.03,.37,0],[-.80,.12,-1.83],[-1.55,-.48,-3.76],[-1.79,-1.07,-6.23]],.018,warm)
  // Only the light inside the gap moves; no swarm is needed to convey the split.
  const lens=new T.Group();lens.position.set(2.43,-.68,4.86);lens.rotation.set(-.09,.68,.32)
  const meniscus=obj(lens,new T.SphereGeometry(1,40,24),quartz(0xc2d1c8,1.16,.75))
  meniscus.scale.set(1.16,.72,.145);mount.add(lens)
  const holder=ring(lens,bronze,1.05,.037,0,0,-.075,P*1.12);holder.scale.y=.65;holder.rotation.z=-2.91
  return head
}

/** Status: a suspended comparator. A cut-through optical body, eccentric lens,
 * trunnions and an unbalanced yoke cast one legible reflection in the black pool. */
export function comparator(parent:T.Group){
  const frame=new T.Group();frame.position.set(2.50,0,-92.6);parent.add(frame)
  const metal=alloy(0x292a30,0xb2a5a0,1.14),satin=alloy(0x1e2025,0x928c93,.83)
  const brass=alloy(0x302c27,0xb89d7e,1.10),optic=quartz(0xc0becb,1.39,.78)
  // Cast base ground to a shallow knife edge, with two exposed adjustable feet.
  const footPlan:Pair[]=[[-2.54,-.81],[-1.82,-1.18],[1.65,-1.07],[2.51,-.38],[2.34,.51],[1.77,.78],[-1.72,.77],[-2.54,.35]]
  const foot=obj(frame,cast(footPlan,.27,.10),satin,0,-2.91,.12);foot.rotation.x=-P/2
  for(const x of [-1.54,1.52]){
    const toe=obj(frame,new T.CylinderGeometry(.38,.31,.25,32),brass,x,-3.16,.42)
    toe.rotation.y=.38
  }
  // A single load-bearing wishbone opens to the front. No enclosing cylinder or overhead lid.
  const left=cast([[-2.04,-2.76],[-1.39,-2.76],[-1.06,-2.46],[-1.41,-1.61],[-1.64,.24],
    [-1.73,.68],[-1.98,.70],[-2.18,.41],[-2.07,-.75],[-1.92,-1.79]],.47,.066)
  obj(frame,left,metal,-.03,0,-.17)
  const returnArm=obj(frame,left,satin,.11,-.02,-.48);returnArm.scale.set(-.90,.93,.84)
  // Real bearing points align on the pivot; these small details are only readable at closest approach.
  for(const x of [-1.85,1.74]){
    const axle=obj(frame,new T.CylinderGeometry(.148,.148,.56,28),brass,x,.41,-.13)
    axle.rotation.z=P/2
    pin(frame,brass,.161,.26,x,.40,.145)
  }
  const head=new T.Group();head.position.set(-.03,.48,0);frame.add(head)
  const aperture=cast(shoulder,.73,.126,[bore(-.15,.25,.86,.92)])
  const shell=obj(head,aperture,optic);shell.rotation.z=-.14
  // A third of the rear perimeter is silvered; the broad face remains
  // open to the set so the material transmits, rather than hiding behind a plate.
  rail(head,[[-1.52,-1.00,-.39],[-1.61,-.32,-.39],[-1.26,.91,-.39],[-.69,1.41,-.39]],.046,metal)
  const upper=ring(head,brass,.87,.031,-.11,.26,.40,P*1.27);upper.rotation.z=.76
  const lower=ring(head,metal,.875,.034,-.11,.26,-.42,P*1.16);lower.rotation.z=-2.47
  // A movable, biased observation lens crosses *part* of the aperture. Do not plug its clear center.
  const lensRig=new T.Group();lensRig.position.set(.22,.24,-.19);head.add(lensRig)
  const lens=obj(lensRig,new T.SphereGeometry(1,48,28),quartz(0xa9c9c6,.89,.67))
  lens.scale.set(.54,.61,.17);lens.rotation.set(.27,-.4,.23)
  const retainer=ring(lensRig,brass,.565,.021,0,0,-.01,P*1.36)
  retainer.scale.y=1.114;retainer.rotation.z=-.72
  rail(lensRig,[[.49,.3,0],[.77,.45,-.06],[1.04,.48,-.12]],.036,satin,18)
  // Machine graduation, not interface text. Twenty-three high/low notches follow a single sector.
  placeBatch(head,new T.BoxGeometry(1,1,1),brass,23,(o,i)=>{
    const a=.24+i*.064;o.position.set(Math.cos(a)*1.01-.03,Math.sin(a)*1.04+.13,.355)
    o.scale.set(i%5===0?.105:.050,.017,.021);o.rotation.set(0,0,a)
  })
  // The light source is a physical plate, not a screen-space flare. It is
  // partly occulted by the head and transmitted through its offset meniscus.
  pin(frame,satin,.69,.12,-.18,.83,-1.11)
  // CylinderGeometry cap has Y-up local coordinates. A direct face receives
  // the sapphire strip and stays aligned to the source independently of the pivot.
  obj(frame,new T.CircleGeometry(.67,52),comparatorTarget(),-.18,.83,-1.041)
  block(frame,satin,[.13,2.71,.19],[-.30,-.78,-1.18])
  const assembly=new T.Group()
  for(const piece of [...frame.children])assembly.add(piece)
  assembly.scale.setScalar(1.18);assembly.position.y=.575;frame.add(assembly)
  const pool=obj(frame,new T.PlaneGeometry(57,48),liquidFloor(),0,-3.24,-1.4)
  pool.rotation.x=-P/2;pool.layers.set(WATER_LAYER)
  return {head,lensRig}
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

/** An engraving behind the status head is rendered on the opaque pass, so it
 * appears under the real refraction rather than as paint on the front glass. */
export function indexSector(head:T.Group){
  const sector=ring(head,ruledFace(),1.11,.065,-.04,.20,-.49,P*.99)
  sector.rotation.z=.62;sector.scale.y=1.08
}
