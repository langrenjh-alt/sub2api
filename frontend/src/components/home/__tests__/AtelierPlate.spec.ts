import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AtelierPlate from '../AtelierPlate.vue'

describe('non-WebGL poster',()=>{
  it('uses the portrait crop only in the static picture',()=>{
    const w=mount(AtelierPlate,{props:{progress:0}})
    expect(w.get('source').attributes('srcset')).toBe('/assets/home/atelier-portrait.webp')
    expect(w.get('img').attributes('alt')).toBe('')
  })
  it('has no simulated sprite depths, pointer transforms, or second canvas',()=>{
    const w=mount(AtelierPlate,{props:{progress:0}})
    expect(w.findAll('img')).toHaveLength(1)
    expect(w.find('canvas,.plate-depth,.plate-spec').exists()).toBe(false)
  })
})
