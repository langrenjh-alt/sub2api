type LocaleTree = Record<string, unknown>

function isLocaleTree(value: unknown): value is LocaleTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mergeLocale<T extends LocaleTree>(base: T, overrides: LocaleTree): T {
  const merged: LocaleTree = { ...base }

  for (const [key, value] of Object.entries(overrides)) {
    const current = merged[key]
    merged[key] = isLocaleTree(current) && isLocaleTree(value)
      ? mergeLocale(current, value)
      : value
  }

  return merged as T
}
