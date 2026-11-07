import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createJourneyRail } from '../journey/cameraRail'

describe('continuous camera through the opening',()=>{
  it('passes the world-space word along its left flank, not through a scaled picture',()=>{
    const travel=createJourneyRail(),eye=new Vector3(),gaze=new Vector3()
    travel(0,eye,gaze);expect(eye.z).toBeCloseTo(18)
    let prev=eye.z,crossed=false
    for(let i=1;i<=250;i++){
      travel(i/1000,eye,gaze)
      expect(eye.z).toBeLessThan(prev)
      if(prev>=7.1 && eye.z<=7.1){crossed=true;expect(eye.x).toBeLessThan(-3.0)}
      prev=eye.z
    }
    expect(crossed).toBe(true);expect(eye.z).toBeLessThan(-6)
  })
  it('is reversible and never jumps a pose on either shoulder of the two former cuts',()=>{
    const travel=createJourneyRail(),eye=new Vector3(),gaze=new Vector3()
    for(const p of [.12,.13,.15,.18,.21,.25,.55,.78]){
      travel(p-1e-5,eye,gaze);const a=eye.clone()
      travel(p+1e-5,eye,gaze);expect(a.distanceTo(eye)).toBeLessThan(.012)
      travel(1,eye,gaze);travel(p-1e-5,eye,gaze);expect(eye.distanceTo(a)).toBeCloseTo(0,9)
    }
  })
})
