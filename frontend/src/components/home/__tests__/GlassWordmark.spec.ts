import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GlassWordmark from '../GlassWordmark.vue'

const { make, engine } = vi.hoisted(() => ({
  make: vi.fn(),
  engine: { position: vi.fn(), active: vi.fn(), input: vi.fn(), orbit: vi.fn(), dispose: vi.fn() },
}))
vi.mock('../glass/scene', () => ({ createGlassScene: make }))

function mountWord() {
  const host = document.createElement('div')
  host.className = 'signal'
  document.body.append(host)
  return mount(GlassWordmark, { attachTo: host, props: { active: true, pointerX: 0, pointerY: 0 } })
}

describe('glass wordmark enhancement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.stubGlobal('ResizeObserver', class {})
    make.mockResolvedValue(engine)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('keeps the accessible vector if no WebGL implementation exists', async () => {
    vi.stubGlobal('WebGL2RenderingContext', undefined)
    const word = mountWord()
    await flushPromises()
    expect(make).not.toHaveBeenCalled()
    expect(word.attributes('data-renderer')).toBe('svg')
    expect(word.get('img').attributes('alt')).toBe('Z30')
    word.unmount()
  })

  it('pauses the renderer and restores the vector after context loss', async () => {
    const word = mountWord()
    await flushPromises()
    expect(word.attributes('data-renderer')).toBe('webgl')
    await word.setProps({ active: false, pointerX: 0.7, pointerY: -0.4 })
    expect(engine.active).toHaveBeenLastCalledWith(false)
    expect(engine.input).toHaveBeenLastCalledWith(0.7, -0.4)
    await word.get('canvas').trigger('webglcontextlost')
    expect(word.attributes('data-renderer')).toBe('svg')
    word.unmount()
    expect(engine.dispose).toHaveBeenCalledOnce()
  })

  it('does not hide the vector when the optics pass fails to initialize', async () => {
    make.mockRejectedValueOnce(new Error('context allocation failed'))
    const word = mountWord()
    await flushPromises()
    expect(word.attributes('data-renderer')).toBe('svg')
    expect(word.get('img').attributes('src')).toBe('/z30-emblem.svg')
    word.unmount()
  })
})
