import * as T from 'three'

/** Shared survey of the optical bench. Points, guide geometry, packet clock
 * and camera all refer to the same two physical interfaces. Units: scene units. */
export const benchAngle = new T.Euler(.10,-1.31,-.18)
export const irisAngle = new T.Euler(.145,-.28,-.19)
const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z)
export const splitPoint=(x:number,y=0,z=0)=>v(x,y+.38,z).applyEuler(benchAngle).add(v(3.28,-.13,-61.82))
export const irisPoint=(x:number,y:number,z:number)=>v(x,y,z).applyEuler(irisAngle)
  .add(v(-.05,.42,-.03)).multiplyScalar(1.16).add(v(2.5,.54,-92.6))
const nodes=[
  splitPoint(8.0),splitPoint(4.6),splitPoint(2.0),splitPoint(1.08),splitPoint(0),splitPoint(-1.08),splitPoint(-3.49),splitPoint(-4.65),
  v(.36,1.02,-69.5),v(-1.5,1.6,-73.2),v(-1.35,.93,-77.0),v(1.75,.28,-80.4),v(4.02,1.57,-84.2),
  irisPoint(0,0,5.35),irisPoint(0,0,2.10),irisPoint(0,0,.14),irisPoint(0,0,-1.40),irisPoint(0,0,-5.75)
]
export const opticalLine=new T.CatmullRomCurve3(nodes,false,'centripetal')
opticalLine.arcLengthDivisions=(nodes.length-1)*80
const arc=opticalLine.getLengths(), marks=nodes.map((_,i)=>arc[i*80])
export const bondDistance=marks[4], apertureDistance=marks[15], lineLength=marks[17]
const itinerary=[
  [.638,0],[.670,marks[1]*.42],[.709,marks[2]],[.726,marks[3]],[.746,marks[4]],
  [.761,marks[5]],[.780,marks[6]],[.803,marks[8]],[.828,marks[10]],
  [.853,marks[12]],[.878,marks[13]],[.898,marks[14]],[.914,marks[15]],
  [.927,marks[16]],[.958,marks[17]],
]
const secant=(i:number)=>(itinerary[i+1][1]-itinerary[i][1])/(itinerary[i+1][0]-itinerary[i][0])
const slopes=itinerary.map((_,i)=>i===0||i===itinerary.length-1?0:2/(1/secant(i-1)+1/secant(i)))
/** Hermite interpolation on measured distance (not elapsed time). Reversing the
 * wheel rewinds the same photon on both sides of the coated bond. */
export function beamDistance(p:number){
  if(p<=itinerary[0][0])return 0
  let i=0
  while(i<itinerary.length-2&&p>itinerary[i+1][0])i++
  const [lo,a]=itinerary[i],[hi,b]=itinerary[i+1],dt=hi-lo
  const t=T.MathUtils.clamp((p-lo)/dt,0,1),t2=t*t,t3=t2*t
  return a+(b-a)*(3*t2-2*t3)+dt*(slopes[i]*(t3-2*t2+t)+slopes[i+1]*(t3-t2))
}
export const flightBlend=(p:number)=>T.MathUtils.smoothstep(p,.605,.707)
export const nearFlight=(p:number)=>flightBlend(p)*(1-T.MathUtils.smoothstep(p,.922,.962))
export const pointOnBeam=(dist:number,out:T.Vector3)=>opticalLine.getPointAt(T.MathUtils.clamp(dist/lineLength,0,1),out)

export function createBeamCamera(){
  const right=v(0,0,0), tangent=v(0,0,-1),up=v(0,1,0),pos=v(0,0,0),aim=v(0,0,0)
  const finish=v(0,0,0),endLook=v(0,0,0)
  return (p:number,eye:T.Vector3,gaze:T.Vector3,aspect:number)=>{
    const handoff=flightBlend(p)
    if(!handoff)return
    const portrait=1-T.MathUtils.smoothstep(aspect,.55,1.22)
    const d=beamDistance(p),dock=T.MathUtils.smoothstep(p,.666,.717)
    const alongside=T.MathUtils.smoothstep(p,.765,.809)*(1-T.MathUtils.smoothstep(p,.855,.899))
    opticalLine.getTangentAt(d/lineLength,tangent);right.crossVectors(tangent,up).normalize()
    pointOnBeam(d,pos)
    // Ride a few cm beside the axis in the inlet and pupil; wider tracking
    // distance in the transfer reveals where the selected branch is heading.
    // Between the two small ferrules the body opens up. Follow the split
    // slightly off axis so both branches read at the bond, not just end-on.
    const within=Math.min(1,Math.abs(d-bondDistance)/1.07)
    const shoulder=.32*(1-within*within)**2
    pos.addScaledVector(right,-.065-3.25*(1-dock)-(.94-.55*portrait)*alongside-shoulder)
    pos.y+=.035+1.15*(1-dock)+.32*alongside+.33*shoulder
    pointOnBeam(d+1.38+3.3*(1-dock)+(2.5-1.88*portrait)*alongside,aim)
    aim.addScaledVector(right,-.19*(1-portrait)-1.13*(1-dock))
    // After passing through the iris, peel away from the light on a rising
    // jib. The transmitted spot lands on a real downstream screen. The lens
    // looks back at both ends of that last segment without a cut.
    const arcOut=T.MathUtils.smoothstep(p,.917,.979)
    finish.copy(irisPoint(8.5-3.7*portrait+.9*T.MathUtils.smoothstep(p,.971,1),2.30+.28*portrait,-6.5-.85*portrait))
    endLook.copy(irisPoint(-.46+.42*portrait,.04,-2.30+2.42*portrait))
    pos.lerp(finish,arcOut);aim.lerp(endLook,arcOut)
    eye.lerp(pos,handoff);gaze.lerp(aim,handoff)
  }
}
