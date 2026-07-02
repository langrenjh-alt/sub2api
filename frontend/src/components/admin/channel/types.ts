import type { BillingMode, PricingInterval } from '@/api/admin/channels'

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

export interface IntervalFormEntry {
  min_tokens: number
  max_tokens: number | null
  tier_label: string
  input_price: number | string | null
  output_price: number | string | null
  cache_write_price: number | string | null
  cache_read_price: number | string | null
  per_request_price: number | string | null
  sort_order: number
}

export interface PricingFormEntry {
  models: string[]
  billing_mode: BillingMode
  input_price: number | string | null
  output_price: number | string | null
  cache_write_price: number | string | null
  cache_read_price: number | string | null
  image_output_price: number | string | null
  per_request_price: number | string | null
  intervals: IntervalFormEntry[]
}

// 價格轉換：後端存 per-token，前端顯示 per-MTok ($/1M tokens)
const MTOK = 1_000_000

export function toNullableNumber(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return isNaN(num) ? null : num
}

/** 前端顯示值($/MTok) → 後端儲存值(per-token) */
export function mTokToPerToken(val: number | string | null | undefined): number | null {
  const num = toNullableNumber(val)
  return num === null ? null : parseFloat((num / MTOK).toPrecision(10))
}

/** 後端儲存值(per-token) → 前端顯示值($/MTok) */
export function perTokenToMTok(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null
  // toPrecision(10) 消除 IEEE 754 浮點乘法精度誤差，如 5e-8 * 1e6 = 0.04999...96 → 0.05
  return parseFloat((val * MTOK).toPrecision(10))
}

export function apiIntervalsToForm(intervals: PricingInterval[]): IntervalFormEntry[] {
  return (intervals || []).map(iv => ({
    min_tokens: iv.min_tokens,
    max_tokens: iv.max_tokens,
    tier_label: iv.tier_label || '',
    input_price: perTokenToMTok(iv.input_price),
    output_price: perTokenToMTok(iv.output_price),
    cache_write_price: perTokenToMTok(iv.cache_write_price),
    cache_read_price: perTokenToMTok(iv.cache_read_price),
    per_request_price: iv.per_request_price,
    sort_order: iv.sort_order
  }))
}

export function formIntervalsToAPI(intervals: IntervalFormEntry[]): PricingInterval[] {
  return (intervals || []).map(iv => ({
    min_tokens: iv.min_tokens,
    max_tokens: iv.max_tokens,
    tier_label: iv.tier_label,
    input_price: mTokToPerToken(iv.input_price),
    output_price: mTokToPerToken(iv.output_price),
    cache_write_price: mTokToPerToken(iv.cache_write_price),
    cache_read_price: mTokToPerToken(iv.cache_read_price),
    per_request_price: toNullableNumber(iv.per_request_price),
    sort_order: iv.sort_order
  }))
}

// ── 模型模式衝突檢測 ──────────────────────────────────────

interface ModelPattern {
  pattern: string
  prefix: string  // lowercase, 萬用字元去掉尾部 *
  wildcard: boolean
}

function toModelPattern(model: string): ModelPattern {
  const lower = model.toLowerCase()
  const wildcard = lower.endsWith('*')
  return {
    pattern: model,
    prefix: wildcard ? lower.slice(0, -1) : lower,
    wildcard,
  }
}

function patternsConflict(a: ModelPattern, b: ModelPattern): boolean {
  if (!a.wildcard && !b.wildcard) return a.prefix === b.prefix
  if (a.wildcard && !b.wildcard) return b.prefix.startsWith(a.prefix)
  if (!a.wildcard && b.wildcard) return a.prefix.startsWith(b.prefix)
  // 雙萬用字元：任一字首是另一字首的字首即衝突
  return a.prefix.startsWith(b.prefix) || b.prefix.startsWith(a.prefix)
}

/** 檢測模型模式列表中的衝突，返回衝突的兩個模式名；無衝突返回 null */
export function findModelConflict(models: string[]): [string, string] | null {
  const patterns = models.map(toModelPattern)
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      if (patternsConflict(patterns[i], patterns[j])) {
        return [patterns[i].pattern, patterns[j].pattern]
      }
    }
  }
  return null
}

// ── 區間校驗 ──────────────────────────────────────────────

/** 校驗區間列表的合法性，返回錯誤訊息；通過則返回 null
 *
 * mode 決定區間語義：
 * - token：區間是上下文 token 數分段 (min, max]，不能重疊，無上限段必須放最後
 * - per_request / image：區間是按 tier_label 分層（1K/2K/4K 等），後端按 label
 *   匹配，不依賴 min/max，因此跳過重疊 / last-unlimited 校驗
 */
export function validateIntervals(
  intervals: IntervalFormEntry[],
  mode: BillingMode,
  t: TranslateFn,
): string | null {
  if (!intervals || intervals.length === 0) return null

  // 按 min_tokens 排序（不修改原陣列）
  const sorted = [...intervals].sort((a, b) => a.min_tokens - b.min_tokens)

  for (let i = 0; i < sorted.length; i++) {
    const err = validateSingleInterval(sorted[i], i, t)
    if (err) return err
  }

  // per_request / image 模式按 tier_label 匹配，不做 token 區間重疊校驗
  if (mode !== 'token') return null
  return checkIntervalOverlap(sorted, t)
}

function validateSingleInterval(iv: IntervalFormEntry, idx: number, t: TranslateFn): string | null {
  if (iv.min_tokens < 0) {
    return `區間 #${idx + 1}: 最小 token 數 (${iv.min_tokens}) 不能為負數`
  }
  if (iv.max_tokens != null) {
    if (iv.max_tokens <= 0) {
      return `區間 #${idx + 1}: 最大 token 數 (${iv.max_tokens}) 必須大於 0`
    }
    if (iv.max_tokens <= iv.min_tokens) {
      return `區間 #${idx + 1}: 最大 token 數 (${iv.max_tokens}) 必須大於最小 token 數 (${iv.min_tokens})`
    }
  }
  return validateIntervalPrices(iv, idx, t)
}

function validateIntervalPrices(iv: IntervalFormEntry, idx: number, _t: TranslateFn): string | null {
  const prices: [string, number | string | null][] = [
    ['輸入價格', iv.input_price],
    ['輸出價格', iv.output_price],
    ['快取寫入價格', iv.cache_write_price],
    ['快取讀取價格', iv.cache_read_price],
    ['單次價格', iv.per_request_price],
  ]
  for (const [key, val] of prices) {
    if (val != null && val !== '' && Number(val) < 0) {
      return `區間 #${idx + 1}: ${key}不能為負數`
    }
  }
  return null
}

function checkIntervalOverlap(sorted: IntervalFormEntry[], _t: TranslateFn): string | null {
  for (let i = 0; i < sorted.length; i++) {
    // 無上限區間必須是最後一個
    if (sorted[i].max_tokens == null && i < sorted.length - 1) {
      return `區間 #${i + 1}: 無上限區間（最大 token 數為空）只能是最後一個`
    }
    if (i === 0) continue
    const prev = sorted[i - 1]
    // (min, max] 語義：前一個區間上界 > 當前區間下界則重疊
    if (prev.max_tokens == null || prev.max_tokens > sorted[i].min_tokens) {
      const prevMax = prev.max_tokens == null ? '∞' : String(prev.max_tokens)
      return `區間 #${i} 和 #${i + 1} 重疊：前一個區間上界 (${prevMax}) 大於當前區間下界 (${sorted[i].min_tokens})`
    }
  }
  return null
}

/** 平台對應的模型 tag 樣式（背景+文字） */
export function getPlatformTagClass(platform: string): string {
  switch (platform) {
    case 'anthropic': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'openai': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'gemini': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'antigravity': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'grok': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

/** 平台對應的模型文字色（僅 text-*，用於 input/text 場景）— 與 getPlatformTagClass 同色系 */
export function getPlatformTextClass(platform: string): string {
  switch (platform) {
    case 'anthropic': return 'text-orange-700 dark:text-orange-400'
    case 'openai': return 'text-emerald-700 dark:text-emerald-400'
    case 'gemini': return 'text-blue-700 dark:text-blue-400'
    case 'antigravity': return 'text-purple-700 dark:text-purple-400'
    case 'grok': return 'text-slate-700 dark:text-slate-300'
    default: return ''
  }
}
