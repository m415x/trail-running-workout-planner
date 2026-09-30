import { WeekDay, WeekDayRaw, DayStatus } from '@/types'

/**
 * Normalizes a YYYY-MM-DD civil date into a local Date without UTC offset drift.
 */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Resolves the visual state of one microcycle day. */
export function getDayStatus(day: WeekDay): DayStatus {
  if (day.isRest) return 'rest'
  if (day.isDone) return 'completed'
  if (day.isPartial) return 'partial'
  if (day.isMissed) return 'missed'

  return 'pending'
}

/** Formats a civil date for presentation using an explicit presentation locale. */
export function formatShortDate(date: Date | string, presentationLocale: string): string {
  const dateObj = typeof date === 'string' ? parseISODate(date) : date
  return new Intl.DateTimeFormat(presentationLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dateObj)
}

/** Formats a civil date in long form using an explicit presentation locale. */
export function formatFullDate(date: Date | string, presentationLocale: string): string {
  const dateObj = typeof date === 'string' ? parseISODate(date) : date
  return new Intl.DateTimeFormat(presentationLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObj)
}

/** Formats a civil date range using an explicit presentation locale. */
export function formatDateRange(
  startDateStr: string,
  endDateStr: string,
  presentationLocale: string,
): string {
  const formatter = new Intl.DateTimeFormat(presentationLocale, {
    month: 'short',
    day: 'numeric',
  })

  return `${formatter.format(parseISODate(startDateStr))}–${formatter.format(parseISODate(endDateStr))}`
}

/** Converts a raw week day to presentation data using an explicit presentation locale. */
export function formatRawWeekDay(rawDay: WeekDayRaw, presentationLocale: string): WeekDay {
  const dateObj = parseISODate(rawDay.date)
  const today = new Date()
  const isToday =
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()

  return {
    ...rawDay,
    day: new Intl.DateTimeFormat(presentationLocale, { weekday: 'narrow' })
      .format(dateObj)
      .toUpperCase(),
    dayName: new Intl.DateTimeFormat(presentationLocale, { weekday: 'short' }).format(dateObj),
    dayNumber: dateObj.getDate(),
    fullDate: rawDay.date,
    isToday: rawDay.isToday ?? isToday,
  }
}

/** Returns Monday at local midnight for the supplied date. */
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Generates the Monday-Sunday range and a localized presentation label. */
export function generateWeekRange(baseDate: Date, presentationLocale: string) {
  const monday = getMondayOfWeek(baseDate)
  const days: Date[] = []

  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday)
    nextDay.setDate(monday.getDate() + i)
    days.push(nextDay)
  }

  const sunday = days[6]
  const formatter = new Intl.DateTimeFormat(presentationLocale, {
    month: 'short',
    day: 'numeric',
  })

  return {
    monday,
    sunday,
    days,
    label: `${formatter.format(monday)} – ${formatter.format(sunday)}`,
  }
}
