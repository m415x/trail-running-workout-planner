import type { SupportedLocale } from '@/i18n/messages'

interface DateTimePresentationContext {
  language: SupportedLocale
  presentationLocale: string
  timeZone: string
}

/**
 * Formats an absolute instant using the product's 24-hour date-time convention.
 *
 * Presentation locale and operational timezone are explicit inputs. The
 * formatter does not infer regional policy from the product language.
 */
export function formatDateTime24Hour(
  value: string | Date | null | undefined,
  context: DateTimePresentationContext,
): string {
  if (!value) return '—'

  const date = value instanceof Date ? value : new Date(value)
  const formattedDate = new Intl.DateTimeFormat(context.presentationLocale, {
    timeZone: context.timeZone,
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(date)
  const formattedTime = new Intl.DateTimeFormat(context.presentationLocale, {
    timeZone: context.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)

  return `${formattedDate} · ${formattedTime} ${context.language === 'en' ? 'h' : 'hs'}`
}
