import { describe, expect, it } from 'vitest'

import en from '../locales/en'
import zh from '../locales/zh'

describe('GeeTest settings locale keys', () => {
  it.each([
    ['en', en],
    ['zh', zh]
  ])('provides every label used by SettingsView for %s', (_locale, messages) => {
    const geetest = messages.admin.settings.geetest

    expect(geetest.title).toBeTruthy()
    expect(geetest.description).toBeTruthy()
    expect(geetest.enable).toBeTruthy()
    expect(geetest.enableHint).toBeTruthy()
    expect(geetest.captchaId).toBeTruthy()
    expect(geetest.captchaIdHint).toBeTruthy()
    expect(geetest.console).toBeTruthy()
    expect(geetest.captchaKey).toBeTruthy()
    expect(geetest.captchaKeyHint).toBeTruthy()
    expect(geetest.captchaKeyConfiguredHint).toBeTruthy()
    expect(messages.auth.geetestFailed).toBeTruthy()
  })
})
