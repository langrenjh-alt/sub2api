import * as T from 'three'
import { createBeamCamera } from './opticalFlight'
type Key=[number,number,number,number,number,number,number]
/** Absolute camera and look-at keys. Between keys the lens follows a C1 spline,
 * not a stack of dissolve-only scenes. Each room occupies different world space. */
const keys: Key[] = [
  [0,0,.25,18,0,.20,7.1], [.038,-.32,.35,16.7,-.02,.22,6.1],
  [.078,-1.46,.56,13.1,-.24,.26,3.5], [.118,-2.95,.73,9.45,-1.08,.31,.24],
  [.148,-3.54,.68,6.63,-2.13,.21,-4.30], [.185,-2.83,.49,2.43,-2.17,.12,-10], [.25,-1.65,.95,-7,-.52,.1,-22],
  [.32,-3.48,1.55,-23,-.12,.4,-38],
  [.39,-3.25,.74,-33.0,.36,.52,-43], [.47,.53,.48,-34.4,.36,.58,-43],
  [.54,6.80,1.46,-36.6,1.29,.18,-44.2], [.57,6.95,1.16,-41.3,2.41,-.44,-50.8],
  [.605,5.22,.85,-48.4,2.44,-.38,-58.2],
  [.65,3.14,.51,-53.2,.45,.48,-65], [.72,.1,.52,-56.1,.21,.32,-64],
  [.78,-2.72,1.2,-66.1,.16,.15,-78.3], [.83,-3.04,.92,-75.4,-.20,.15,-91],
  [.90,-1.90,1.19,-80.6,-.76,-.61,-93], [.96,.34,1.70,-81.25,-.69,-.83,-93],
  [1,3.1,1.51,-81.7,-.60,-.75,-93],
]

/** One world-space rail. Never tween the letters to follow the lens. XYZ are
 * in scene units and the sign change relative to z=7.1 is the physical pass. */
export function createJourneyRail(){
  const track=createBeamCamera()
  const path=new T.CatmullRomCurve3(keys.map(k=>new T.Vector3(k[1],k[2],k[3])))
  const focus=new T.CatmullRomCurve3(keys.map(k=>new T.Vector3(k[4],k[5],k[6])))
  const segment=(p:number)=>{
    let i=0
    while(i<keys.length-2&&keys[i+1][0]<p)i++
    return (i+(p-keys[i][0])/(keys[i+1][0]-keys[i][0]))/(keys.length-1)
  }
  // Three's ordinary CatmullRom is C1 in knot index, but chapter progress
  // keys are not uniformly spaced. A monotone cubic map keeps dolly velocity
  // continuous at their boundaries, including the gallery-to-conduit turn.
  const slopes=keys.map((k,i)=>{
    if(i===0)return 1/(keys[1][0]-k[0])
    if(i===keys.length-1)return 1/(k[0]-keys[i-1][0])
    return 2/(keys[i+1][0]-keys[i-1][0])
  })
  const drive=(p:number)=>{
    const raw=segment(p)*(keys.length-1),i=Math.min(keys.length-2,Math.floor(raw))
    const u=raw-i,dt=keys[i+1][0]-keys[i][0],u2=u*u,u3=u2*u
    return (i+3*u2-2*u3+dt*(slopes[i]*(u3-2*u2+u)+slopes[i+1]*(u3-u2)))/(keys.length-1)
  }
  return (progress:number,eye:T.Vector3,gaze:T.Vector3,follow=true,aspect=1.6)=>{
    const u=drive(T.MathUtils.clamp(progress,0,1))
    path.getPoint(u,eye);focus.getPoint(u,gaze)
    if(follow)track(progress,eye,gaze,aspect)
  }
}
