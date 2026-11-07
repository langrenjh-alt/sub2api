import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JourneyWorld from '../JourneyWorld.vue'

const api=vi.hoisted(()=>({create:vi.fn(),update:vi.fn(),dispose:vi.fn()}))
vi.mock('../journey/worldScene',()=>({createJourneyRenderer:api.create}))
const props={progress:0,active:true,reduced:false,pointerX:0,pointerY:0}
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})

describe('shared world renderer',()=>{
  it('signals WebGL only after the first shared draw and never inserts image transitions',async()=>{
    const ready:Array<()=>void>=[]
    api.create.mockImplementation((_canvas,cb)=>{ready.push(cb);return {update:api.update,dispose:api.dispose}})
    vi.stubGlobal('WebGL2RenderingContext',class {})
    vi.stubGlobal('matchMedia',()=>({matches:false}))
    const w=mount(JourneyWorld,{props});await flushPromises()
    expect(w.attributes('data-renderer')).toBe('pending')
    ready[0]();await flushPromises()
    expect(w.attributes('data-renderer')).toBe('webgl')
    await w.setProps({progress:.15,pointerX:.65})
    expect(w.findAll('canvas')).toHaveLength(1)
    expect(w.find('picture,img').exists()).toBe(false)
    expect(api.update).toHaveBeenLastCalledWith({...props,progress:.15,pointerX:.65})
    await w.get('canvas').trigger('webglcontextlost')
    expect(w.attributes('data-renderer')).toBe('still')
    expect(w.find('picture').exists()).toBe(true)
    await w.get('canvas').trigger('webglcontextrestored');await flushPromises()
    ready[1]();await flushPromises()
    expect(w.find('picture').exists()).toBe(false)
    w.unmount();expect(api.dispose).toHaveBeenCalledTimes(2)
  })
  it('uses static keyframes when no GPU is available without creating a substitute WebGL context',async()=>{
    vi.stubGlobal('WebGL2RenderingContext',undefined)
    const w=mount(JourneyWorld,{props:{...props,progress:.94,reduced:true}})
    await flushPromises()
    expect(w.attributes('data-renderer')).toBe('still')
    expect(w.get('img').attributes('src')).toMatch(/observatory-wide\.webp$/)
    expect(api.create).not.toHaveBeenCalled()
    w.unmount()
  })
})
