/**
 * 驗證並規範化 URL
 * 預設只接受絕對 URL（以 http:// 或 https:// 開頭），可按需允許相對路徑
 * @param value 使用者輸入的 URL
 * @returns 規範化後的 URL，如果無效則返回空字串
 */
type SanitizeOptions = {
  allowRelative?: boolean
  allowDataUrl?: boolean
}

export function sanitizeUrl(value: string, options: SanitizeOptions = {}): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (options.allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }

  // 允許 data:image/ 開頭的 data URL（僅限圖片型別）
  if (options.allowDataUrl && trimmed.startsWith('data:image/')) {
    return trimmed
  }

  // 只接受絕對 URL，不使用 base URL 來避免相對路徑被解析為當前域名
  // 檢查是否以 http:// 或 https:// 開頭
  if (!trimmed.match(/^https?:\/\//i)) {
    return ''
  }

  try {
    const parsed = new URL(trimmed)
    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') {
      return ''
    }
    return parsed.toString()
  } catch {
    return ''
  }
}
