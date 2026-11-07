import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createJourneyRail } from '../journey/cameraRail'
import { apertureDistance, beamDistance, bondDistance, irisPoint, opticalLine, pointOnBeam, splitPoint } from '../journey/opticalFlight'
import { irisChapterStart, irisReadingPose } from '../journey/path'

const travel=createJourneyRail()
function camera(p:number,follow=true){
  const eye=new Vector3(),gaze=new Vector3();travel(p,eye,gaze,follow);return {eye,gaze}
}
describe('one shot along the transmitted branch',()=>{
  it('preserves every earlier eye and aim sample, including the archive handoff',()=>{
    for(let i=0;i<=605;i+=5){const a=camera(i/1000),b=camera(i/1000,false)
      expect(a.eye.distanceTo(b.eye)+a.gaze.distanceTo(b.gaze)).toBe(0)}
  })
  it('crosses both actual interfaces, in order, within the clear optical openings',()=>{
    for(const [p,d,point,r] of [[.746,bondDistance,splitPoint(0),.43],[.914,apertureDistance,irisPoint(0,0,.14),.13]] as const){
      expect(beamDistance(p)).toBeCloseTo(d,6)
      expect(pointOnBeam(d,new Vector3()).distanceTo(point)).toBeLessThan(.0001)
      expect(camera(p).eye.distanceTo(point)).toBeLessThan(r)
      const axis=opticalLine.getTangentAt(d/opticalLine.getLength())
      expect(camera(p-.009).eye.sub(point).dot(axis)).toBeLessThan(0)
      expect(camera(p+.009).eye.sub(point).dot(axis)).toBeGreaterThan(0)
    }
    expect(irisChapterStart).toBeLessThan(.914);expect(irisReadingPose).toBeGreaterThan(.94)
  })
  it('does not stall, teleport or depend on event order while tracking',()=>{
    let last=camera(.665),dist=beamDistance(.665)
    for(let i=666;i<=980;i++){const p=i/1000,now=camera(p)
      expect(now.eye.distanceTo(last.eye)).toBeLessThan(.89)
      expect(now.gaze.distanceTo(now.eye)).toBeGreaterThan(.5)
      expect(beamDistance(p)).toBeGreaterThanOrEqual(dist-1e-10)
      last=now;dist=beamDistance(p)
    }
    for(const p of [.69,.746,.835,.914,.974]){const a=camera(p);camera(1)
      expect(camera(p).eye.distanceTo(a.eye)).toBe(0)}
  })
})
