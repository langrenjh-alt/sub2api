import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import Toggle from '@/components/common/Toggle.vue'
import Input from '@/components/common/Input.vue'

enableAutoUnmount(afterEach)

describe('Z30 component compatibility', () => {
  it('styles a single anchor instead of wrapping it in a button', () => {
    const link = mount(Button, {
      props: { asChild: true, variant: 'ghost', class: 'h-11' },
      slots: { default: () => h('a', { href: '/login' }, 'Enter') },
    })
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('/login')
    expect(link.classes()).toContain('h-11')
    expect(link.classes()).not.toContain('h-9')
  })

  it('keeps switch semantics and external value updates', async () => {
    const wrapper = mount(Toggle, { props: { modelValue: false }, attrs: { 'aria-label': 'Enabled' } })
    const control = wrapper.get('[role="switch"]')
    expect(control.attributes('aria-checked')).toBe('false')
    expect(control.attributes('aria-label')).toBe('Enabled')
    await control.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    await wrapper.setProps({ modelValue: true })
    expect(control.attributes('aria-checked')).toBe('true')
  })

  it('links field labels/errors and retains native focus, select and string updates', async () => {
    const wrapper = mount(Input, {
      attachTo: document.body,
      props: { label: 'Name', error: 'Required', modelValue: 'before' },
    })
    const field = wrapper.get('input')
    expect(field.attributes('id')).not.toBe('')
    expect(wrapper.get('label').attributes('for')).toBe(field.attributes('id'))
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(document.getElementById(field.attributes('aria-describedby')!)?.textContent).toBe('Required')
    wrapper.vm.focus()
    wrapper.vm.select()
    expect(document.activeElement).toBe(field.element)
    expect(field.element.selectionEnd).toBe(6)
    await field.setValue('after')
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([['after']])
  })
})
