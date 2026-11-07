import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GlassWordmark from '../GlassWordmark.vue'

describe('semantic glass title',()=>{
  it('defers all live optics to the world, with one accessible title',()=>{
    const w=mount(GlassWordmark,{props:{mode:'webgl',progress:0}})
    expect(w.get('h1').text()).toBe('Z30')
    expect(w.find('img,canvas').exists()).toBe(false)
  })
  it('returns the unbacked vector only when the graphics context is absent',async()=>{
    const w=mount(GlassWordmark,{props:{mode:'webgl',progress:0}})
    await w.setProps({mode:'still'})
    expect(w.get('h1').attributes('data-renderer')).toBe('svg')
    expect(w.get('img').attributes('src')).toBe('/z30-emblem.svg')
    expect(w.get('img').attributes('alt')).toBe('Z30')
    await w.setProps({mode:'webgl'})
    expect(w.find('canvas,img').exists()).toBe(false)
  })
})
