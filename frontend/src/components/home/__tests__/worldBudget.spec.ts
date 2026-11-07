import { describe, expect, it } from 'vitest'
import { PixelBudget } from '../journey/worldBudget'

describe('world pixel budget', () => {
  it('ignores gaps and isolated long frames', () => {
    const budget = new PixelBudget()
    expect(budget.sample(600)).toBe(false)
    expect(budget.sample(38)).toBe(false)
    for (let i=0;i<220;i++) budget.sample(16.67)
    expect(budget.scale).toBe(1)
  })
  it('drops after sustained pressure and recovers much more slowly', () => {
    const budget = new PixelBudget()
    for (let i=0;i<180;i++) budget.sample(34)
    expect(budget.scale).toBeCloseTo(.68)
    for (let i=0;i<150;i++) budget.sample(16)
    expect(budget.scale).toBeCloseTo(.68)
    for (let i=0;i<2100;i++) budget.sample(16)
    expect(budget.scale).toBe(1)
  })
})
