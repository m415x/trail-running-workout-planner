export type SupportedAuthLocale = 'es' | 'en'

function normalizeLocale(locale: SupportedAuthLocale): SupportedAuthLocale {
  return locale === 'en' ? 'en' : 'es'
}

function containsRedirectEscape(path: string): boolean {
  const lower = path.toLowerCase()

  return (
    path.includes('\\') ||
    lower.includes('%5c') ||
    lower.includes('%2f')
  )
}

export function resolveSafeAuthReturnPath(
  candidate: string | null | undefined,
  locale: SupportedAuthLocale,
): string {
  const safeLocale = normalizeLocale(locale)
  const fallback = `/${safeLocale}`

  if (!candidate) {
    return fallback
  }

  const value = candidate.trim()

  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  if (containsRedirectEscape(value)) {
    return fallback
  }

  const expectedPrefix = `/${safeLocale}`

  if (value !== expectedPrefix && !value.startsWith(`${expectedPrefix}/`)) {
    return fallback
  }

  return value
}
