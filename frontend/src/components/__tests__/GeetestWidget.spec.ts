import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import GeetestWidget from '../GeetestWidget.vue'

describe('GeetestWidget', () => {
  afterEach(() => {
    vi.useRealTimers()
    document
      .querySelectorAll(
        'script[src="https://static.geetest.com/v4/gt4.js"], script[src="https://static.geevisit.com/v4/gt4.js"]'
      )
      .forEach(node => node.remove())
    delete window.initGeetest4
  })

  it('loads the SDK, emits validation events, and exposes reset', async () => {
    let successHandler: (() => void) | undefined
    let failHandler: (() => void) | undefined
    let errorHandler: (() => void) | undefined
    let closeHandler: (() => void) | undefined
    let initHandler: ((instance: unknown) => void) | undefined
    let initializationErrorHandler: (() => void) | undefined

    const validation = {
      lot_number: 'lot-number',
      captcha_output: 'captcha-output',
      pass_token: 'pass-token',
      gen_time: '1700000000'
    }
    const instance = {
      appendTo: vi.fn(),
      getValidate: vi.fn(() => validation),
      onReady: vi.fn(function () {
        return instance
      }),
      onSuccess: vi.fn(function (handler: () => void) {
        successHandler = handler
        return instance
      }),
      onFail: vi.fn(function (handler: () => void) {
        failHandler = handler
        return instance
      }),
      onError: vi.fn(function (handler: () => void) {
        errorHandler = handler
        return instance
      }),
      onClose: vi.fn(function (handler: () => void) {
        closeHandler = handler
        return instance
      }),
      reset: vi.fn(),
      destroy: vi.fn()
    }

    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} }
    })
    const wrapper = mount(GeetestWidget, {
      props: { captchaId: 'captcha-id' },
      global: { plugins: [i18n] }
    })

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://static.geetest.com/v4/gt4.js"]'
    )
    expect(script).not.toBeNull()

    const initGeetest4 = vi.fn((config, handler) => {
      initializationErrorHandler = config.onError
      initHandler = handler
    })
    window.initGeetest4 = initGeetest4
    script!.dispatchEvent(new Event('load'))
    await flushPromises()

    expect(initGeetest4).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaId: 'captcha-id',
        product: 'float',
        language: 'eng',
        protocol: 'https://',
        timeout: 10000
      }),
      expect.any(Function)
    )

    initHandler?.(instance)
    expect(instance.appendTo).toHaveBeenCalledWith(expect.any(HTMLElement))

    successHandler?.()
    expect(wrapper.emitted('verify')).toEqual([[validation]])
    const exposed = wrapper.vm as unknown as {
      reset: () => void
      getValidation: () => typeof validation | null
    }
    expect(exposed.getValidation()).toEqual(validation)

    failHandler?.()
    expect(exposed.getValidation()).toBeNull()

    successHandler?.()
    expect(exposed.getValidation()).toEqual(validation)

    instance.getValidate.mockImplementationOnce(
      () => false as unknown as typeof validation
    )
    successHandler?.()
    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(exposed.getValidation()).toBeNull()

    successHandler?.()
    expect(exposed.getValidation()).toEqual(validation)
    closeHandler?.()
    expect(exposed.getValidation()).toBeNull()
    expect(wrapper.emitted('invalid')).toHaveLength(2)

    successHandler?.()
    errorHandler?.()
    expect(exposed.getValidation()).toBeNull()
    initializationErrorHandler?.()
    expect(wrapper.emitted('error')).toHaveLength(3)

    exposed.reset()
    expect(instance.reset).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('invalid')).toHaveLength(3)

    await wrapper.setProps({ captchaId: 'captcha-id-2' })
    await flushPromises()
    expect(instance.destroy).toHaveBeenCalledTimes(1)
    const verifyEventCount = wrapper.emitted('verify')?.length
    const invalidEventCount = wrapper.emitted('invalid')?.length
    const errorEventCount = wrapper.emitted('error')?.length
    const getValidateCallCount = instance.getValidate.mock.calls.length

    successHandler?.()
    failHandler?.()
    errorHandler?.()
    closeHandler?.()
    expect(instance.getValidate).toHaveBeenCalledTimes(getValidateCallCount)
    expect(wrapper.emitted('verify')).toHaveLength(verifyEventCount ?? 0)
    expect(wrapper.emitted('invalid')).toHaveLength(invalidEventCount ?? 0)
    expect(wrapper.emitted('error')).toHaveLength(errorEventCount ?? 0)

    wrapper.unmount()
    expect(instance.destroy).toHaveBeenCalledTimes(1)
  })

  it('emits an error when the SDK script fails to load', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} }
    })
    const wrapper = mount(GeetestWidget, {
      props: { captchaId: 'captcha-id' },
      global: { plugins: [i18n] }
    })
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://static.geetest.com/v4/gt4.js"]'
    )

    script!.dispatchEvent(new Event('error'))
    await flushPromises()
    const fallbackScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://static.geevisit.com/v4/gt4.js"]'
    )
    expect(fallbackScript).not.toBeNull()
    fallbackScript!.dispatchEvent(new Event('error'))
    await flushPromises()

    expect(wrapper.emitted('error')).toHaveLength(1)
    wrapper.unmount()
    consoleError.mockRestore()
  })

  it('times out instead of waiting forever for an existing SDK script', async () => {
    vi.useFakeTimers()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const existingScript = document.createElement('script')
    existingScript.src = 'https://static.geetest.com/v4/gt4.js'
    document.head.appendChild(existingScript)
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} }
    })
    const wrapper = mount(GeetestWidget, {
      props: { captchaId: 'captcha-id' },
      global: { plugins: [i18n] }
    })

    await vi.advanceTimersByTimeAsync(10000)
    await flushPromises()
    expect(
      document.querySelector('script[src="https://static.geevisit.com/v4/gt4.js"]')
    ).not.toBeNull()
    await vi.advanceTimersByTimeAsync(10000)
    await flushPromises()

    expect(wrapper.emitted('error')).toHaveLength(1)
    wrapper.unmount()
    consoleError.mockRestore()
  })

  it('recovers with a fresh script after all loader domains fail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
    const first = mount(GeetestWidget, {
      props: { captchaId: 'captcha-id' },
      global: { plugins: [i18n] }
    })

    document
      .querySelector<HTMLScriptElement>('script[src="https://static.geetest.com/v4/gt4.js"]')!
      .dispatchEvent(new Event('error'))
    await flushPromises()
    document
      .querySelector<HTMLScriptElement>('script[src="https://static.geevisit.com/v4/gt4.js"]')!
      .dispatchEvent(new Event('error'))
    await flushPromises()
    first.unmount()

    const second = mount(GeetestWidget, {
      props: { captchaId: 'captcha-id' },
      global: { plugins: [i18n] }
    })
    const freshScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://static.geetest.com/v4/gt4.js"]'
    )
    expect(freshScript).not.toBeNull()
    window.initGeetest4 = vi.fn()
    freshScript!.dispatchEvent(new Event('load'))
    await flushPromises()
    expect(window.initGeetest4).toHaveBeenCalled()

    second.unmount()
    consoleError.mockRestore()
  })
})
