import * as T from 'three'
import { obj, block, cast, pin, rail, placeBatch } from './worldAtelier'
import { turnedMetal, quartz, liquidFloor, WATER_LAYER, ceramicFinish, coatedBlade, instrumentBeam,
  bondCoat, comparatorTarget } from './worldMaterials'

const PI=Math.PI,TAU=2*PI
type XYZ=[number,number,number]
type Cross=readonly [radius:number,z:number]
const V=(p:XYZ)=>new T.Vector3(...p)

/** Turn an actual hollow section, including back, front, bore and machined lips.
 * Coordinates are radius and axial distance, not stacked closed cylinders. */
function turning(parent:T.Object3D,profile:Cross[],m:T.Material,n=88){
  const q=profile.map(([r,z])=>new T.Vector2(r,z))
  const g=new T.LatheGeometry(q,n);g.rotateX(PI/2)
  return obj(parent,g,m)
}
function oriented(parent:T.Object3D,base:XYZ,axis:XYZ){
  const g=new T.Group();parent.add(g);g.position.set(...base)
  g.quaternion.setFromUnitVectors(V([0,0,1]),V(axis).normalize())
  return g
}
function roundedCasting(shape:T.Shape,depth:number,bevel:number){
  return new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,
    bevelThickness:bevel,curveSegments:22}).translate(0,0,-depth*.5)
}
function opticTrain(group:T.Group,base:XYZ,axis:XYZ,kind:'source'|'port',silver:T.Material,
  insulator:T.Material,brass:T.Material,black:T.Material){
  const tube=oriented(group,base,axis)
  // Recessed annulus, stepped spigot and rolled edge constitute a single ferrule.
  const m=kind==='source'?1:.85
  tube.scale.setScalar(m)
  turning(tube,[[.15,-.09],[.42,-.09],[.46,-.04],[.46,.08],[.422,.126],[.349,.126],
    [.342,.20],[.32,.23],[.32,.50],[.30,.525],[.205,.525],[.185,.50],[.15,-.09]],silver,72)
  turning(tube,[[.273,.23],[.332,.23],[.337,.25],[.337,.411],[.329,.426],[.273,.426],[.273,.23]],insulator,56)
  turning(tube,[[.15,.50],[.307,.50],[.307,.544],[.288,.558],[.15,.558],[.15,.50]],brass,60)
  turning(tube,[[.15,.075],[.20,.075],[.20,.501],[.152,.501],[.15,.075]],black,48)
  return tube
}

/** A bonded cube accepts a pulse from the right; the diagonal dielectric film
 * divides it into a straight (cool) and a reflected (warm) output. */
export function splitterBench(scene:T.Group){
  const mount=new T.Group();mount.position.set(3.28,-.18,-61.6);scene.add(mount)
  const titanium=turnedMetal(0x777a7d,.88),graphite=turnedMetal(0x272a2d,.48)
  const ivory=ceramicFinish(),brass=turnedMetal(0x8d785e,.78)
  const bench=new T.Group();bench.position.set(0,.05,-.22);bench.rotation.set(.10,-.30,-.18);mount.add(bench)
  const crystal=new T.Group();crystal.position.set(0,.38,0);bench.add(crystal)
  // Two true right-angle prisms, not two decorative shards. Their 45° faces
  // meet across a narrow bond line through the optical axis.
  const a=cast([[-1.08,-1.05],[1.03,-1.05],[-1.08,1.075]],1.36,.035)
  const b=cast([[1.09,-.993],[1.09,1.10],[-1.015,1.10]],1.36,.035)
  obj(crystal,a,quartz(0x6597b8,1.66,.58,0,.76));obj(crystal,b,quartz(0xacbfd3,1.39,.46,0,.64))
  const film=obj(crystal,new T.PlaneGeometry(2.89,1.29),bondCoat())
  // Plane local X follows the diagonal, plane local Y follows the depth.
  film.rotation.order='ZXY';film.rotation.x=PI/2;film.rotation.z=-PI/4
  const ferrules=[
    {p:[1.105,0,0],v:[1,0,0],k:'source'},{p:[-1.105,0,0],v:[-1,0,0],k:'port'},
    {p:[0,1.118,0],v:[0,1,0],k:'port'},
  ] as const
  for(const {p,v,k} of ferrules)opticTrain(crystal,[...p],[...v],k,titanium,ivory,brass,graphite)
  // Arc length is shared across all three segments: a light packet reaches
  // the bond only once, then both arms carry energy away from that same point.
  const incoming=3.34
  rail(crystal,[[incoming,0,0],[1.46,0,0],[0,0,0]],.027,instrumentBeam(0, incoming,0),24)
  rail(crystal,[[0,0,0],[-1.47,0,0],[-2.87,0,0]],.024,instrumentBeam(incoming,2.87,1),24)
  rail(crystal,[[0,0,0],[0,1.46,0],[0,2.62,0]],.021,instrumentBeam(incoming,2.62,2),24)
  // Cable jacket ends at the inlet. The free path inside the glass is never
  // confused with the much thicker sheathing outside the coupling.
  rail(crystal,[[4.20,-1.63,2.41],[3.61,-1.07,1.40],[3.09,-.28,.33],[2.61,0,0],[2.0,0,0]],.10,graphite,55)
  opticTrain(crystal,[-2.92,0,0],[-1,0,0],'port',graphite,ivory,titanium,graphite)
  opticTrain(crystal,[0,2.67,0],[0,1,0],'port',graphite,ivory,titanium,graphite)
  // Cast receiver arms terminate at the collars, outside the working axes.
  // Negative space between carrier and crystal exposes both light paths.
  const arm=new T.Shape();arm.moveTo(-.72,-1.44);arm.lineTo(-1.55,-1.44)
  arm.quadraticCurveTo(-1.88,-1.43,-2.06,-1.23);arm.lineTo(-3.05,-.25)
  arm.quadraticCurveTo(-3.32,.14,-3.22,.48);arm.lineTo(-2.88,.54)
  arm.quadraticCurveTo(-2.80,.20,-2.67,.045);arm.lineTo(-1.83,-.83)
  arm.quadraticCurveTo(-1.62,-.99,-1.39,-.98);arm.lineTo(-.72,-.98);arm.closePath()
  obj(bench,roundedCasting(arm,.35,.051),titanium,0,0,-.19)
  const mast=new T.Shape();mast.moveTo(.95,-.82);mast.quadraticCurveTo(1.86,-.69,2.04,-.12)
  mast.lineTo(2.18,2.33);mast.quadraticCurveTo(2.21,2.88,1.62,3.07)
  mast.lineTo(.04,3.32);mast.lineTo(-.10,3.12);mast.lineTo(.06,2.95)
  mast.lineTo(1.52,2.73);mast.quadraticCurveTo(1.83,2.67,1.80,2.39)
  mast.lineTo(1.67,.17);mast.quadraticCurveTo(1.60,-.22,.96,-.34);mast.closePath()
  obj(bench,roundedCasting(mast,.30,.048),graphite,0,0,-.34)
  for(const [x,y] of [[-3.04,.39],[.02,3.17],[1.87,2.60]])pin(bench,titanium,.071,.14,x,y,-.06)
  const cradle=cast([[-1.40,-1.03],[-1.37,-.44],[-1.17,-.36],[-1.06,-.76],[1.09,-.76],[1.18,-.33],
    [1.37,-.40],[1.40,-.99],[.91,-1.36],[-.84,-1.36]],1.26,.085)
  obj(bench,cradle,ivory,0,.07,0)
  block(bench,titanium,[2.0,.13,1.51],[0,-1.22,0])
  for(const x of [-1.13,1.13]){
    pin(bench,graphite,.12,.067,x,-.81,.72)
    const slot=block(bench,brass,[.118,.018,.012],[x,-.81,.758]);slot.rotation.z=.42
  }
  // A one-piece flexure is machined away at its middle: the opening casts a
  // characteristic shadow independent of the contour of the prism above it.
  const base=new T.Group();mount.add(base)
  const flex=new T.Shape();flex.moveTo(-1.32,-3.77);flex.lineTo(1.29,-3.77);flex.quadraticCurveTo(1.45,-3.62,1.27,-3.43)
  flex.lineTo(.60,-1.42);flex.lineTo(.39,-1.26);flex.lineTo(-.52,-1.26);flex.lineTo(-.78,-1.48);flex.lineTo(-1.42,-3.44);flex.closePath()
  const hole=new T.Path();hole.absellipse(-.06,-2.65,.38,.72,0,TAU,true,-.16);flex.holes.push(hole)
  obj(base,roundedCasting(flex,.77,.09),titanium,0,0,-.18)
  const shoe=obj(base,cast([[-2.24,-.92],[-1.61,-1.18],[1.56,-1.02],[2.25,-.51],[2.13,.77],[-1.79,.83]],.32,.075),graphite,0,-4.04,-.10);shoe.rotation.x=-PI/2
  placeBatch(base,new T.CylinderGeometry(.27,.32,.30,24),brass,3,(o,i)=>{
    const a=i*TAU/3;o.position.set(Math.cos(a)*1.50,-4.30,Math.sin(a)*.61);o.scale.setScalar(1);o.rotation.set(0,0,0)
  })
  // Captive micrometer, engine-turned crown and a single engraved scale:
  // physical details become readable only on the approach, not as fake UI.
  const dial=oriented(base,[.73,-2.30,.05],[1,.07,.18])
  turning(dial,[[.13,-.04],[.23,-.04],[.23,.35],[.38,.39],[.40,.45],[.40,.79],[.37,.84],[.22,.84],[.13,-.04]],titanium,72)
  placeBatch(dial,new T.BoxGeometry(1,1,1),graphite,32,(o,i)=>{
    const t=i*TAU/32;o.position.set(.401*Math.cos(t),.401*Math.sin(t),.61);o.scale.set(.020,.012,.26);o.rotation.set(0,0,t)
  })
  return (time:number,p:number)=>{
    bench.rotation.y=-.31+.09*Math.sin(time*.085)+.085*Math.sin((p-.60)*8)
    dial.rotation.z=.16*Math.sin(time*.11)
  }
}

function diaphragmLeaf(){
  // The cam pin is at the local origin. The rounded leading edge overlaps the
  // following blade; the matte finish and bevel reveal its independent depth.
  const r=1.18,s=new T.Shape(),x=(n:number)=>n-r
  // The working edge is tangent to the clear opening. Both of its ends
  // extend well beneath the neighbouring blades. The union of the nine
  // leaves therefore produces a convex aperture at EVERY cam angle, not
  // a decorative star with exposed triangular tips.
  s.moveTo(x(1.26),-.91)
  s.bezierCurveTo(x(1.56),-.59,x(1.62),-.03,x(1.43),.51)
  s.bezierCurveTo(x(1.34),.79,x(1.19),.91,x(1.077),.79)
  s.quadraticCurveTo(x(.64),.018,x(.22),-.76)
  s.bezierCurveTo(x(.48),-.99,x(.94),-1.01,x(1.26),-.91);s.closePath()
  return roundedCasting(s,.009,.004)

}

/** Floating metrology head. A nine-leaf mechanical diaphragm, an eccentric
 * scan lens and a ground detector share one actual working optical axis. */
export function scanningComparator(scene:T.Group){
  const frame=new T.Group();frame.position.set(2.5,0,-92.6);scene.add(frame)
  const titanium=turnedMetal(0x777a7d,.88),satin=turnedMetal(0x434549,.57)
  const pvd=turnedMetal(0x1b2027,.39),champagne=turnedMetal(0x9d8168,.78)
  const ceramic=ceramicFinish(),assembly=new T.Group();frame.add(assembly);assembly.scale.setScalar(1.16);assembly.position.y=.54
  // Single smooth U yoke, thicker at its table foot and relieved around the
  // aperture. Contour does not close above the instrument.
  const fork=new T.Shape();fork.moveTo(-2.14,.68)
  fork.bezierCurveTo(-2.33,.64,-2.32,.37,-2.26,.04);fork.lineTo(-1.98,-1.73)
  fork.bezierCurveTo(-1.89,-2.19,-1.51,-2.48,-1.08,-2.61);fork.lineTo(-.73,-2.74);fork.lineTo(-.66,-2.90)
  fork.lineTo(.95,-2.90);fork.lineTo(1.09,-2.66);fork.bezierCurveTo(1.62,-2.43,1.93,-2.06,1.98,-1.46)
  fork.lineTo(2.09,.28);fork.bezierCurveTo(2.09,.61,1.96,.74,1.76,.63)
  fork.bezierCurveTo(1.64,.53,1.64,.31,1.67,.03);fork.lineTo(1.59,-1.44)
  fork.bezierCurveTo(1.54,-1.83,1.22,-2.10,.84,-2.16);fork.lineTo(-.66,-2.16)
  fork.bezierCurveTo(-1.16,-2.08,-1.48,-1.79,-1.51,-1.43);fork.lineTo(-1.74,.19)
  fork.bezierCurveTo(-1.77,.51,-1.93,.70,-2.14,.68);fork.closePath()
  obj(assembly,roundedCasting(fork,.54,.082),titanium,0,0,-.31)
  const foot=obj(assembly,cast([[-2.48,-.80],[-1.73,-1.18],[1.48,-1.14],[2.37,-.53],[2.29,.45],[1.68,.77],[-1.75,.72],[-2.46,.25]],.30,.105),satin,0,-2.92,.14);foot.rotation.x=-PI/2
  for(const x of [-1.55,1.50]){
    const pad=oriented(assembly,[x,-3.25,.41],[0,1,0])
    turning(pad,[[.16,0],[.32,0],[.38,.04],[.38,.15],[.36,.19],[.18,.22],[.16,0]],champagne,46)
  }
  const head=new T.Group();head.position.set(-.05,.42,-.03);assembly.add(head)
  // Actual rear barrel, floating sapphire seat, and milled stepped bezel. The
  // free center remains open all the way back to the detector.
  turning(head,[[1.12,-.65],[1.46,-.65],[1.57,-.51],[1.57,-.38],[1.49,-.34],[1.51,-.23],
    [1.66,-.14],[1.67,-.05],[1.63,.035],[1.29,.055],[1.23,.00],[1.12,-.65]],titanium)
  turning(head,[[1.10,.02],[1.50,.02],[1.54,.068],[1.54,.143],[1.51,.16],[1.24,.16],[1.205,.11],[1.10,.02]],pvd)
  // Ceramic sector and recessed rear graduation break the otherwise circular
  // silhouette and offer a coherent stationary reference for the rotating cam.
  const housing=new T.Shape();housing.moveTo(-1.57,-.48);housing.quadraticCurveTo(-1.88,-.41,-1.88,-.16)
  housing.lineTo(-1.88,.26);housing.quadraticCurveTo(-1.84,.46,-1.59,.54);housing.lineTo(-1.30,.42)
  housing.lineTo(-1.31,-.43);housing.closePath()
  obj(head,roundedCasting(housing,.71,.065),ceramic,-.02,0,-.30)
  for(const x of [-1.83,1.85]){
    const bearing=oriented(assembly,[x,.41,-.20],[x<0?-1:1,0,0])
    turning(bearing,[[.18,-.30],[.26,-.30],[.26,-.11],[.39,-.09],[.41,-.03],[.41,.12],[.35,.18],[.18,.18],[.18,-.30]],champagne,55)
  }
  // The conductor from the splitter plugs into the receiving trunnion.
  // This is where the progress-driven travelling glint reaches the detector.
  opticTrain(assembly,[2.0,.41,-.20],[1,0,0],'port',titanium,ceramic,champagne,pvd)
  const cam=new T.Group();head.add(cam)
  turning(cam,[[1.05,.12],[1.36,.12],[1.42,.166],[1.42,.209],[1.385,.23],[1.10,.23],[1.05,.18],[1.05,.12]],champagne)
  placeBatch(cam,new T.BoxGeometry(1,1,1),pvd,78,(o,i)=>{
    const a=i*TAU/78;o.position.set(1.28*Math.cos(a),1.28*Math.sin(a),.237)
    o.scale.set(i%6===0?.104:.054,.014,.012);o.rotation.set(0,0,a)
  })
  // A fixed witness mark makes the slow cam rotation readable. It sits on
  // the outer housing, not on the leaf drive ring whose movement it indexes.
  const index=cast([[-.11,.17],[.11,.17],[0.,-.065]],.046,.016)
  obj(head,index,champagne,0,1.42,.237)
  const count=9,pivots=new T.InstancedMesh(new T.CylinderGeometry(.050,.053,.024,16),champagne,count)
  const blades=new T.InstancedMesh(diaphragmLeaf(),coatedBlade(),count)
  head.add(blades,pivots);const d=new T.Object3D(),pinD=new T.Object3D()
  blades.instanceMatrix.setUsage(T.DynamicDrawUsage);blades.frustumCulled=false;pivots.frustumCulled=false
  for(let i=0;i<count;i++){
    const a=i*TAU/count;pinD.position.set(1.18*Math.cos(a),1.18*Math.sin(a),.197)
    pinD.rotation.set(PI/2,0,0);pinD.updateMatrix();pivots.setMatrixAt(i,pinD.matrix)
  }
  const lensRig=new T.Group();head.add(lensRig);lensRig.position.set(.055,-.02,-.32)
  const lens=obj(lensRig,new T.SphereGeometry(1,48,28),quartz(0xb9d5d5,.73,.56,0,.19));lens.scale.set(.92,.92,.21)
  turning(lensRig,[[.86,-.08],[.99,-.08],[1.015,-.035],[1.015,.061],[.984,.081],[.89,.081],[.86,.035],[.86,-.08]],satin)
  const detector=obj(head,new T.CircleGeometry(.99,70),comparatorTarget(),0,0,-.86)
  // The alignment beam scans a physical detector through the opening. Dispersion
  // happens a second time in the actual transmission pass, not on a screen overlay.
  detector.rotation.z=-.12
  const dial=oriented(head,[1.35,-.58,-.29],[.94,-.32,.08])
  turning(dial,[[.10,0],[.22,0],[.25,.16],[.21,.24],[.29,.28],[.31,.33],[.31,.60],[.27,.65],[.12,.65],[.10,0]],titanium,60)
  placeBatch(dial,new T.BoxGeometry(1,1,1),pvd,30,(o,i)=>{
    const a=i*TAU/30;o.position.set(.309*Math.cos(a),.309*Math.sin(a),.455);o.scale.set(.018,.016,.21);o.rotation.set(0,0,a)
  })
  const water=obj(frame,new T.PlaneGeometry(57,48),liquidFloor(),0,-3.24,-1.4)
  water.rotation.x=-PI/2;water.layers.set(WATER_LAYER)
  return (time:number,p:number)=>{
    const arrival=T.MathUtils.smoothstep(p,.79,.975),osc=Math.sin(time*.42+arrival*1.90)
    const act=-.06-.12*Math.cos(arrival*TAU)+.26*osc
    // Nine independently pinned blades move together through the physical cam.
    for(let i=0;i<count;i++){
      const a=i*TAU/count
      d.position.set(1.18*Math.cos(a),1.18*Math.sin(a),.006+i*.019)
      d.rotation.order='ZXY';d.rotation.set(.002,.005+Math.cos(a)*.002,a+act)
      d.updateMatrix();blades.setMatrixAt(i,d.matrix)
    }
    blades.instanceMatrix.needsUpdate=true;cam.rotation.z=act*.41
    head.rotation.set(.145+.045*Math.sin(time*.17),-.28+.17*Math.sin(time*.15+p*1.9),-.19)
    lensRig.rotation.y=.11*Math.sin(time*.25+arrival);lensRig.position.x=.045+.041*osc
  }
}
