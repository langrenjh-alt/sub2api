import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AtelierPlate from '../AtelierPlate.vue'

const props={progress:0,x:0,y:0,active:true,reduced:false}
describe('atelier opening plate',()=>{
  it('uses the dedicated portrait composition rather than cutting a phone crop from the landscape',()=>{
    const w=mount(AtelierPlate,{props})
    expect(w.get('.plate-far source').attributes('srcset')).toBe('/assets/home/atelier-portrait.webp')
    expect(w.get('.signal-plate').attributes('fetchpriority')).toBe('high')
  })
  it('reopens the optical aperture when travelling back to the origin',async()=>{
    const w=mount(AtelierPlate,{props})
    await w.setProps({progress:.19})
    expect((w.get('.atelier-frame').element as HTMLElement).style.display).toBe('none')
    await w.setProps({progress:.07,x:.8})
    expect((w.get('.atelier-frame').element as HTMLElement).style.display).not.toBe('none')
    expect((w.get('.atelier-frame').element as HTMLElement).style.maskImage).toContain('radial-gradient')
    await w.setProps({progress:0})
    expect((w.get('.atelier-frame').element as HTMLElement).style.maskImage).toBe('none')
  })
  it('keeps a static single exposure in reduced motion',()=>{
    const w=mount(AtelierPlate,{props:{...props,active:false,reduced:true}})
    expect((w.get('.plate-depth').element as HTMLElement).style.display).toBe('none')
    expect(w.find('.plate-left-light').exists()).toBe(false)
    expect(w.get('.atelier-frame').classes()).toContain('is-resting')
  })
})
