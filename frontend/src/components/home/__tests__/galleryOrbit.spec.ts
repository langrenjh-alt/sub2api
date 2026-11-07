import { describe, expect, it } from 'vitest'
import { galleryAngle, panelWindow, blend, galleryWorks, editionIndex, editionFocus } from '../journey/galleryPath'

describe('gallery cylinder', () => {
  it('registers portrait, wide and panoramic editions to the shared optical focus', () => {
    expect(galleryWorks[0].width).toBeGreaterThan(galleryWorks[1].width)
    expect(galleryWorks[1].aspect).toBeLessThan(1)
    expect(galleryWorks[2].aspect).toBeGreaterThan(2)
    expect(editionFocus.map(editionIndex)).toEqual([0,1,2,3])
    expect(editionIndex(.54)).toBe(3)
  })

  it('holds angular separation across forward and reverse sampling', () => {
    const increments=[.29,.347,.42,.52,.485,.347]
      .map(p=>galleryAngle(p,1)-galleryAngle(p,0))
    for(const delta of increments) expect(delta).toBeCloseTo(increments[0],10)
    expect(galleryAngle(.347,0)).toBeCloseTo(0,9)
    expect(galleryAngle(.445,1)).toBeCloseTo(0,9)
    expect(galleryAngle(.50,2)).toBeCloseTo(0,9)
  })
  it('shows neighbouring works together and extends the final work beyond the API boundary', () => {
    expect(panelWindow(.384,0)).toBeGreaterThan(.9)
    expect(panelWindow(.384,1)).toBeGreaterThan(.9)
    expect(panelWindow(.56,2)).toBeGreaterThan(.9)
    expect(panelWindow(.59,3)).toBeGreaterThan(.9)
    expect(panelWindow(.03,0)).toBe(0)
    expect(panelWindow(.88,3)).toBe(0)
  })
  it('never extrapolates a spatial handoff beyond its endpoints', () => {
    expect(blend(.525,.585,0)).toBe(0)
    expect(blend(.525,.585,1)).toBe(1)
    expect(blend(.525,.585,.555)).toBeCloseTo(.5)
  })
})
