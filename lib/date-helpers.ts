import { WeekDay, WeekDayRaw, DayStatus } from '@/types'
import { DAYS_OF_WEEK, MONTHS_OF_YEAR } from '@/lib/constants'

/** Parses YYYY-MM-DD as a local Date without UTC/local day shifting. */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Returns the current calendar date in YYYY-MM-DD for an explicit IANA timezone. */
export function getCurrentISODateInTimeZone(
  timeZone = 'America/Argentina/Buenos_Aires',
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** Maps JavaScript weekday index (Sun=0) to the app index (Mon=0). */
function getNormalizedDayIndex(date: Date): number {
  const jsDay = date.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

/** Resolves the visual status of a microcycle day from already-projected flags. */
export function getDayStatus(day: WeekDay): DayStatus {
  if (day.isRest) return 'rest'
  if (day.isDone) return 'completed'
  if (day.isPartial) return 'partial'
  if (day.isMissed) return 'missed'

  return 'pending'
}

/**
 * Formats a compact date label.
 * @example formatShortDate('2026-08-11') -> "Mar, 11 Ago"
 * @example formatShortDate(1, 11, 7) -> "Mar, 11 Ago"
 */
export function formatShortDate(
  dateOrDayIndex: Date | string | number,
  dateNumber?: number,
  monthIndex?: number,
): string {
  if (typeof dateOrDayIndex === 'number' && dateNumber !== undefined && monthIndex !== undefined) {
    const day = DAYS_OF_WEEK[dateOrDayIndex]?.medium ?? 'Lun'
    const month = MONTHS_OF_YEAR[monthIndex]?.short ?? 'Ene'
    return `${day}, ${dateNumber} ${month}`
  }

  const dateObj = typeof dateOrDayIndex === 'string' ? parseISODate(dateOrDayIndex) : (dateOrDayIndex as Date)
  const dayIdx = getNormalizedDayIndex(dateObj)
  const day = DAYS_OF_WEEK[dayIdx]?.medium ?? 'Lun'
  const month = MONTHS_OF_YEAR[dateObj.getMonth()]?.short ?? 'Ene'

  return `${day}, ${dateObj.getDate()} ${month}`
}

/**
 * Formats a full date label.
 * @example formatFullDate('2026-08-11') -> "Martes · 11 Agosto 2026"
 * @example formatFullDate(1, 11, 7) -> "Martes · 11 Agosto 2026"
 */
export function formatFullDate(
  dateOrDayIndex: Date | string | number,
  dateNumber?: number,
  monthIndex?: number,
): string {
  if (typeof dateOrDayIndex === 'number' && dateNumber !== undefined && monthIndex !== undefined) {
    const day = DAYS_OF_WEEK[dateOrDayIndex]?.full ?? 'Lunes'
    const month = MONTHS_OF_YEAR[monthIndex]?.full ?? 'Enero'
    return `${day} · ${dateNumber} ${month} 2026`
  }

  const dateObj = typeof dateOrDayIndex === 'string' ? parseISODate(dateOrDayIndex) : (dateOrDayIndex as Date)
  const dayIdx = getNormalizedDayIndex(dateObj)
  const day = DAYS_OF_WEEK[dayIdx]?.full ?? 'Lunes'
  const month = MONTHS_OF_YEAR[dateObj.getMonth()]?.full ?? 'Ene'

  return `${day} · ${dateObj.getDate()} ${month} ${dateObj.getFullYear()}`
}

/** Formats the compact weekly date range shown in the calendar header. */
export function formatDateRange(startDateStr: string, endDateStr: string): string {
  const start = parseISODate(startDateStr)
  const end = parseISODate(endDateStr)
  const monthConfig = MONTHS_OF_YEAR[start.getMonth()]

  return `${monthConfig.short} ${start.getDate()}–${end.getDate()}`
}

/** Maps raw database day data to the WeekDay shape consumed by the UI. */
export function formatRawWeekDay(rawDay: WeekDayRaw): WeekDay {
  const dateObj = parseISODate(rawDay.date)
  const dayIdx = getNormalizedDayIndex(dateObj)
  const dayConfig = DAYS_OF_WEEK[dayIdx]

  const today = new Date()
  const isToday =
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()

  return {
    ...rawDay,
    day: dayConfig?.short ?? '',
    dayName: dayConfig?.medium ?? '',
    dayNumber: dateObj.getDate(),
    fullDate: rawDay.date,
    isToday: rawDay.isToday ?? isToday,
  }
}

/** Returns the Monday containing the supplied date. */
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Builds the seven calendar dates for the week containing `baseDate`. */
export function generateWeekRange(baseDate: Date) {
  const monday = getMondayOfWeek(baseDate)
  const days: Date[] = []

  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday)
    nextDay.setDate(monday.getDate() + i)
    days.push(nextDay)
  }

  const sunday = days[6]
  const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  const label =
    monday.getMonth() === sunday.getMonth()
      ? `${monthsShort[monday.getMonth()]} ${monday.getDate()}–${sunday.getDate()}`
      : `${monthsShort[monday.getMonth()]} ${monday.getDate()} – ${monthsShort[sunday.getMonth()]} ${sunday.getDate()}`

  return { monday, sunday, days, label }
}
