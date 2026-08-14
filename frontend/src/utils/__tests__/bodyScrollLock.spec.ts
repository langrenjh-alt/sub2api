import { afterEach, describe, expect, it } from 'vitest'
import { acquireBodyScrollLock } from '../bodyScrollLock'

describe('bodyScrollLock', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('restores the previous overflow only after overlapping locks are released', () => {
    document.body.style.overflow = 'auto'

    const releasePopup = acquireBodyScrollLock()
    const releaseBell = acquireBodyScrollLock()
    expect(document.body.style.overflow).toBe('hidden')

    releasePopup()
    expect(document.body.style.overflow).toBe('hidden')

    releaseBell()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('makes each release callback idempotent', () => {
    document.body.style.overflow = 'scroll'
    const release = acquireBodyScrollLock()

    release()
    release()

    expect(document.body.style.overflow).toBe('scroll')
  })
})
