export type SupportedAuthLocale = 'es' | 'en'

function isSupportedLocale(locale: string): locale is SupportedAuthLocale {
  return locale === 'es' || locale === 'en'
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
  if (!isSupportedLocale(locale)) {
    return '/es'
  }

  const fallback = `/${locale}`

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

  const expectedPrefix = `/${locale}`

  if (value !== expectedPrefix && !value.startsWith(`${expectedPrefix}/`)) {
    return fallback
  }

  return value
}
