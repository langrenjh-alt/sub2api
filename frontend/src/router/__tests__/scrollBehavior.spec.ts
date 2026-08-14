import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { appScrollBehavior } from '../scrollBehavior'

function routeWithHash(hash = ''): RouteLocationNormalized {
  return { hash } as RouteLocationNormalized
}

describe('appScrollBehavior', () => {
  it('restores browser history positions first', () => {
    const savedPosition = { left: 12, top: 34 }

    expect(appScrollBehavior(routeWithHash('#access'), routeWithHash(), savedPosition))
      .toEqual(savedPosition)
  })

  it.each(['#compatibility', '#access'])('positions the %s anchor without smooth-scroll locking', (hash) => {
    expect(appScrollBehavior(routeWithHash(hash), routeWithHash(), null)).toEqual({
      el: hash,
      top: 64,
      behavior: 'instant',
    })
  })

  it('scrolls ordinary route changes to the top', () => {
    expect(appScrollBehavior(routeWithHash(), routeWithHash(), null)).toEqual({ top: 0 })
  })
})
