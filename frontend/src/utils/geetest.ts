import type { GeetestRequestFields, GeetestValidation } from '@/types'

export function toGeetestRequestFields(
  validation: GeetestValidation | null | undefined
): GeetestRequestFields {
  if (!validation) {
    return {}
  }

  return {
    geetest_lot_number: validation.lot_number,
    geetest_captcha_output: validation.captcha_output,
    geetest_pass_token: validation.pass_token,
    geetest_gen_time: validation.gen_time
  }
}

export function readGeetestValidation(
  value: Partial<GeetestRequestFields> | null | undefined
): GeetestValidation | null {
  if (
    !value?.geetest_lot_number ||
    !value.geetest_captcha_output ||
    !value.geetest_pass_token ||
    !value.geetest_gen_time
  ) {
    return null
  }

  return {
    lot_number: value.geetest_lot_number,
    captcha_output: value.geetest_captcha_output,
    pass_token: value.geetest_pass_token,
    gen_time: value.geetest_gen_time
  }
}
