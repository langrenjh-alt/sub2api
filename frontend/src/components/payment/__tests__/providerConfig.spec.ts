import { describe, expect, it } from 'vitest'
import {
  PAYMENT_CURRENCY_OPTIONS,
  PROVIDER_CALLBACK_PATHS,
  PROVIDER_CONFIG_FIELDS,
  PROVIDER_SUPPORTED_TYPES,
  WEBHOOK_PATHS,
} from '@/components/payment/providerConfig'

function findField(providerKey: string, key: string) {
  const fields = PROVIDER_CONFIG_FIELDS[providerKey] || []
  return fields.find(field => field.key === key)
}

describe('PROVIDER_CONFIG_FIELDS.wxpay', () => {
  it('keeps admin form validation aligned with backend-required credentials', () => {
    expect(findField('wxpay', 'publicKeyId')?.optional).toBeFalsy()
    expect(findField('wxpay', 'certSerial')?.optional).toBeFalsy()
  })

  it('only keeps the simplified visible credential set in the admin form', () => {
    expect(findField('wxpay', 'mpAppId')).toBeUndefined()
    expect(findField('wxpay', 'h5AppName')).toBeUndefined()
    expect(findField('wxpay', 'h5AppUrl')).toBeUndefined()
  })
})

describe('PROVIDER_CONFIG_FIELDS.airwallex', () => {
  it('adds currency config with CNY as the default', () => {
    const currency = findField('airwallex', 'currency')

    expect(currency?.defaultValue).toBe('CNY')
    expect(currency?.hintKey).toBe('admin.settings.payment.field_paymentCurrencyHint')
    expect(currency?.options).toBe(PAYMENT_CURRENCY_OPTIONS)
  })

  it('marks accountId as optional and explains when it can be left blank', () => {
    const accountId = findField('airwallex', 'accountId')

    expect(accountId?.optional).toBe(true)
    expect(accountId?.clearable).toBe(true)
    expect(accountId?.hintKey).toBe('admin.settings.payment.field_accountIdHint')
  })

  it('explains that apiBase must match the Airwallex key environment', () => {
    expect(findField('airwallex', 'apiBase')?.hintKey).toBe('admin.settings.payment.field_airwallexApiBaseHint')
  })
})

describe('PROVIDER_CONFIG_FIELDS.stripe', () => {
  it('adds currency config with CNY as the default', () => {
    const currency = findField('stripe', 'currency')

    expect(currency?.defaultValue).toBe('CNY')
    expect(currency?.hintKey).toBe('admin.settings.payment.field_paymentCurrencyHint')
    expect(currency?.options).toBe(PAYMENT_CURRENCY_OPTIONS)
  })
})

describe('PROVIDER_CONFIG_FIELDS.webmoney', () => {
  it('registers WebMoney as a standalone visible payment type with callback paths', () => {
    expect(PROVIDER_SUPPORTED_TYPES.webmoney).toEqual(['webmoney'])
    expect(WEBHOOK_PATHS.webmoney).toBe('/api/v1/payment/webhook/webmoney')
    expect(PROVIDER_CALLBACK_PATHS.webmoney).toEqual({
      notifyUrl: '/api/v1/payment/webhook/webmoney',
      returnUrl: '/payment/result',
    })
  })

  it('adds the required merchant credentials and defaults from WebMoney docs', () => {
    expect(findField('webmoney', 'payeePurse')?.sensitive).toBe(false)
    expect(findField('webmoney', 'secretKey')?.sensitive).toBe(true)
    expect(findField('webmoney', 'secretKeyX20')?.sensitive).toBe(true)
    expect(findField('webmoney', 'secretKeyX20')?.optional).toBe(true)
    expect(findField('webmoney', 'secretKeyX20')?.clearable).toBe(true)
    expect(findField('webmoney', 'paymentUrl')?.defaultValue).toBe('https://merchant.wmtransfer.com/lmi/payment_utf.asp')
    expect(findField('webmoney', 'allowSdp')?.defaultValue).toBe('31')
    expect(findField('webmoney', 'hold')?.optional).toBe(true)
    expect(findField('webmoney', 'hold')?.clearable).toBe(true)
    expect(findField('webmoney', 'simMode')?.defaultValue).toBe('0')
  })

  it('defaults WebMoney settlement currency to USD/WMZ', () => {
    const currency = findField('webmoney', 'currency')

    expect(currency?.defaultValue).toBe('USD')
    expect(currency?.hintKey).toBe('admin.settings.payment.field_webmoneyCurrencyHint')
    expect(currency?.options).toBe(PAYMENT_CURRENCY_OPTIONS)
  })
})
