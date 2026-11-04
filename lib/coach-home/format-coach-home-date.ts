import { APPLICATION_REGIONAL_FALLBACKS } from '@/lib/regionalization/application-regional-context'
import type { SupportedLocale } from '@/i18n/messages'

/**
 * A domain date is a civil YYYY-MM-DD date, not an instant.
 * Convert at UTC midnight and format in UTC to avoid shifting the calendar
 * day when the browser is in another time zone.
 */
export function formatCoachHomeDate(date: string, language: SupportedLocale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const instant = new Date(Date.UTC(year, month - 1, day))
  if (
    instant.getUTCFullYear() !== year
    || instant.getUTCMonth() + 1 !== month
    || instant.getUTCDate() !== day
  ) return date

  return new Intl.DateTimeFormat(
    APPLICATION_REGIONAL_FALLBACKS.presentationLocaleByLanguage[language],
    { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' },
  ).format(instant)
}
