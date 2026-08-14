import { describe, expect, it } from 'vitest'

import en from '../locales/en'
import zh from '../locales/zh'

describe('GeeTest locale keys', () => {
  it.each([
    ['en', en],
    ['zh', zh]
  ])('provides every GeeTest label for %s', (_locale, messages) => {
    expect(messages.admin.settings.captcha.providerGeetest).toBeTruthy()
    expect(messages.admin.settings.geetest.captchaId).toBeTruthy()
    expect(messages.admin.settings.geetest.captchaKey).toBeTruthy()
    expect(messages.admin.settings.geetest.keepExisting).toBeTruthy()
    expect(messages.admin.settings.geetest.configured).toBeTruthy()
    expect(messages.admin.settings.geetest.required).toBeTruthy()
    expect(messages.auth.geetestFailed).toBeTruthy()
  })
})
