/**
 * 格式化工具函式
 * 參考 CRS 專案的 format.js 實現
 */

import { i18n, getLocale } from '@/i18n'

/**
 * 格式化相對時間
 * @param date 日期字串或 Date 物件
 * @returns 相對時間字串，如 "5m ago", "2h ago", "3d ago"
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return i18n.global.t('common.time.never')

  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()

  // 處理未來時間或無效日期
  if (diffMs < 0 || isNaN(diffMs)) return i18n.global.t('common.time.never')

  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return i18n.global.t('common.time.daysAgo', { n: diffDays })
  if (diffHours > 0) return i18n.global.t('common.time.hoursAgo', { n: diffHours })
  if (diffMins > 0) return i18n.global.t('common.time.minutesAgo', { n: diffMins })
  return i18n.global.t('common.time.justNow')
}

/**
 * 格式化數字（支援 K/M/B 單位）
 * @param num 數字
 * @returns 格式化後的字串，如 "1.2K", "3.5M"
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0'

  const locale = getLocale()
  const absNum = Math.abs(num)

  // Use Intl.NumberFormat for compact notation if supported and needed
  // Note: Compact notation in 'zh' uses '萬/億', which is appropriate for Chinese
  const formatter = new Intl.NumberFormat(locale, {
    notation: absNum >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  })

  return formatter.format(num)
}

/**
 * 格式化貨幣金額
 * @param amount 金額
 * @param currency 貨幣程式碼，預設 USD
 * @returns 格式化後的字串，如 "$1.25"
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined) return '$0.00'

  const locale = getLocale()

  // For very small amounts, show more decimals
  const fractionDigits = amount > 0 && amount < 0.01 ? 6 : 2

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(amount)
}

/**
 * 格式化位元組大小
 * @param bytes 位元組數
 * @param decimals 小數位數
 * @returns 格式化後的字串，如 "1.5 MB"
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 格式化日期
 * @param date 日期字串或 Date 物件
 * @param options Intl.DateTimeFormatOptions
 * @param localeOverride 可選 locale 覆蓋
 * @returns 格式化後的日期字串
 */
export function formatDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  },
  localeOverride?: string
): string {
  if (!date) return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return ''

  const locale = localeOverride ?? getLocale()
  return new Intl.DateTimeFormat(locale, options).format(d)
}

/**
 * 格式化日期（只顯示日期部分）
 * @param date 日期字串或 Date 物件
 * @returns 格式化後的日期字串
 */
export function formatDateOnly(date: string | Date | null | undefined): string {
  return formatDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * 格式化日期時間（完整格式）
 * @param date 日期字串或 Date 物件
 * @param options Intl.DateTimeFormatOptions
 * @param localeOverride 可選 locale 覆蓋
 * @returns 格式化後的日期時間字串
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  localeOverride?: string
): string {
  return formatDate(date, options, localeOverride)
}

/**
 * 格式化為 datetime-local 控制元件值（YYYY-MM-DDTHH:mm，使用本地時間）
 */
export function formatDateTimeLocalInput(timestampSeconds: number | null): string {
  if (!timestampSeconds) return ''
  const date = new Date(timestampSeconds * 1000)
  if (isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * 解析 datetime-local 控制元件值為時間戳（秒，使用本地時間）
 */
export function parseDateTimeLocalInput(value: string): number | null {
  if (!value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return Math.floor(date.getTime() / 1000)
}

/**
 * 格式化 OpenAI reasoning effort（用於使用記錄展示）
 * @param effort 原始 effort（如 "low" / "medium" / "high" / "xhigh"）
 * @returns 格式化後的字串（Low / Medium / High / Xhigh），無值返回 "-"
 */
export function formatReasoningEffort(effort: string | null | undefined): string {
  const raw = (effort ?? '').toString().trim()
  if (!raw) return '-'

  const normalized = raw.toLowerCase().replace(/[-_\s]/g, '')
  switch (normalized) {
    case 'low':
      return 'Low'
    case 'medium':
      return 'Medium'
    case 'high':
      return 'High'
    case 'xhigh':
    case 'extrahigh':
      return 'XHigh'
    case 'max':
      return 'Max'
    case 'none':
    case 'minimal':
      return '-'
    default:
      // best-effort: Title-case first letter
      return raw.length > 1 ? raw[0].toUpperCase() + raw.slice(1) : raw.toUpperCase()
  }
}

/**
 * 格式化時間（顯示時分秒）
 * @param date 日期字串或 Date 物件
 * @returns 格式化後的時間字串
 */
export function formatTime(date: string | Date | null | undefined): string {
  return formatDate(date, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * 格式化數字（千分位分隔，不使用緊湊單位）
 * @param num 數字
 * @returns 格式化後的字串，如 "12,345"
 */
export function formatNumberLocaleString(num: number): string {
  return num.toLocaleString()
}

/**
 * 格式化金額（固定小數位，不帶貨幣符號）
 * @param amount 金額
 * @param fractionDigits 小數位數，預設 4
 * @returns 格式化後的字串，如 "1.2345"
 */
export function formatCostFixed(amount: number, fractionDigits: number = 4): string {
  return amount.toFixed(fractionDigits)
}

/**
 * 格式化 token 數量（>=1M 顯示為 M，>=1K 顯示為 K，保留 1 位小數）
 * @param tokens token 數量
 * @returns 格式化後的字串，如 "950", "1.2K", "3.5M"
 */
export function formatTokensK(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

/**
 * 格式化大數字（K/M/B，保留 1 位小數）
 * @param num 數字
 * @param options allowBillions=false 時最高只顯示到 M
 */
export function formatCompactNumber(
  num: number | null | undefined,
  options?: { allowBillions?: boolean }
): string {
  if (num === null || num === undefined) return '0'

  const abs = Math.abs(num)
  const allowBillions = options?.allowBillions !== false

  if (allowBillions && abs >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

/**
 * 格式化倒計時（從現在到目標時間的剩餘時間）
 * @param targetDate 目標日期字串或 Date 物件
 * @returns 倒計時字串，如 "2h 41m", "3d 5h", "15m"
 */
export function formatCountdown(targetDate: string | Date | null | undefined): string | null {
  if (!targetDate) return null

  const now = new Date()
  const target = new Date(targetDate)
  const diffMs = target.getTime() - now.getTime()

  // 如果目標時間已過或無效
  if (diffMs <= 0 || isNaN(diffMs)) return null

  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  const remainingHours = diffHours % 24
  const remainingMins = diffMins % 60

  if (diffDays > 0) {
    // 超過1天：顯示 "Xd Yh"
    return i18n.global.t('common.time.countdown.daysHours', { d: diffDays, h: remainingHours })
  }
  if (diffHours > 0) {
    // 小於1天：顯示 "Xh Ym"
    return i18n.global.t('common.time.countdown.hoursMinutes', { h: diffHours, m: remainingMins })
  }
  // 小於1小時：顯示 "Ym"
  return i18n.global.t('common.time.countdown.minutes', { m: diffMins })
}

/**
 * 格式化倒計時並帶字尾（如 "2h 41m 後解除"）
 * @param targetDate 目標日期字串或 Date 物件
 * @returns 完整的倒計時字串，如 "2h 41m to lift", "2小時41分鐘後解除"
 */
export function formatCountdownWithSuffix(targetDate: string | Date | null | undefined): string | null {
  const countdown = formatCountdown(targetDate)
  if (!countdown) return null
  return i18n.global.t('common.time.countdown.withSuffix', { time: countdown })
}

/**
 * 格式化為相對時間 + 具體時間組合
 * @param date 日期字串或 Date 物件
 * @returns 組合時間字串，如 "5 天前 · 2026-01-27 15:25"
 */
export function formatRelativeWithDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''

  const relativeTime = formatRelativeTime(date)
  const dateTime = formatDateTime(date)

  // 如果是 "從未" 或空字串，只返回相對時間
  if (!dateTime || relativeTime === i18n.global.t('common.time.never')) {
    return relativeTime
  }

  return `${relativeTime} · ${dateTime}`
}
