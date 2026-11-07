import { describe, expect, it } from 'vitest'
import { currentFlightStop, flightProgress, flightStops, followFocus, phase } from '../journey/path'

describe('native scroll flight path', () => {
  it('maps the full runway to [0,1] and clamps overscroll', () => {
    expect(flightProgress(60, 5840, 800)).toBe(0)
    expect(flightProgress(-2520, 5840, 800)).toBe(.5)
    expect(flightProgress(-5040, 5840, 800)).toBe(1)
    expect(flightProgress(-5800, 5840, 800)).toBe(1)
  })
  it('puts every navigable anchor well inside the corresponding scene', () => {
    for (const [i, stop] of flightStops.entries()) expect(currentFlightStop(stop.point)).toBe(i)
    expect(currentFlightStop(1)).toBe(3)
  })
  it('gives identical samples when travelling backwards and leaves endpoints at rest', () => {
    const stops = [0, .1, .15, .2, .5, 1]
    const sample = (p: number) => phase(.1, .2, p)
    const going = stops.map(sample)
    expect(going[0]).toBe(0)
    expect(going.at(-1)).toBe(1)
    expect([...stops].reverse().map(sample).reverse()).toEqual(going)
  })
  it('uses one time-based camera response at 30, 60 and 144 Hz', () => {
    function sample(hz: number) {
      let p = 0, v = 0
      for (let i=0; i<hz/2; i++) [p,v] = followFocus(p,v,.74,1/hz)
      return p
    }
    expect(sample(30)).toBeCloseTo(sample(144), 8)
    expect(sample(60)).toBeGreaterThan(.72)
    expect(sample(60)).toBeLessThan(.74)
  })

  it('reverses and comes to rest at both physical scroll bounds', () => {
    let p=0, v=0
    for(let i=0;i<12;i++) [p,v]=followFocus(p,v,1,1/60)
    expect(p).toBeGreaterThan(.6)
    for(let i=0;i<120;i++) [p,v]=followFocus(p,v,0,1/60)
    expect([p,v]).toEqual([0,0])
  })
})
