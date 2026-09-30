import type { SupportedLocale } from '@/i18n/messages'

export const APPLICATION_REGIONAL_FALLBACKS = {
  presentationLocaleByLanguage: {
    es: 'es-AR',
    en: 'en-US',
  } satisfies Record<SupportedLocale, string>,
  timeZone: 'America/Argentina/Buenos_Aires',
} as const

export interface ApplicationRegionalContext {
  language: SupportedLocale
  presentationLocale: string
  timeZone: string
}

export interface ResolveApplicationRegionalContextInput {
  language: SupportedLocale
  presentationLocale?: string
  timeZone?: string
}

/**
 * Resolves the regional presentation context used by the application while no
 * persisted regional authority exists.
 *
 * The defaults in this module are provisional application fallbacks only.
 * Language, presentation locale and operational time zone remain independent
 * concepts. Currency is intentionally excluded because it belongs to the
 * economic domain and must never be inferred from language or locale.
 */
export function resolveApplicationRegionalContext({
  language,
  presentationLocale,
  timeZone,
}: ResolveApplicationRegionalContextInput): ApplicationRegionalContext {
  return {
    language,
    presentationLocale:
      presentationLocale ?? APPLICATION_REGIONAL_FALLBACKS.presentationLocaleByLanguage[language],
    timeZone: timeZone ?? APPLICATION_REGIONAL_FALLBACKS.timeZone,
  }
}
