const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

/**
 * Formats an instant using the product's 24-hour date-time convention.
 *
 * Argentina remains the presentation time zone until user/team time-zone
 * preferences become part of the product contract.
 */
export function formatDateTime24Hour(
  value: string | Date | null | undefined,
  locale: string,
): string {
  if (!value) return '—'

  const date = value instanceof Date ? value : new Date(value)
  const intlLocale = locale === 'en' ? 'en-US' : 'es-AR'
  const formattedDate = new Intl.DateTimeFormat(intlLocale, {
    timeZone: ARGENTINA_TIME_ZONE,
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(date)
  const formattedTime = new Intl.DateTimeFormat(intlLocale, {
    timeZone: ARGENTINA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)

  return `${formattedDate} · ${formattedTime} ${locale === 'en' ? 'h' : 'hs'}`
}
