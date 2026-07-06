import { describe, expect, it } from 'vitest'

import en from '../locales/en'
import zh from '../locales/zh'

describe('admin group locale keys', () => {
  it('contains labels used by the group column settings control', () => {
    expect(zh.admin.groups.columnSettings).toBe('列設定')
    expect(en.admin.groups.columnSettings).toBe('Column Settings')
  })
})
