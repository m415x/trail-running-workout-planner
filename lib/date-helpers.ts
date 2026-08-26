import { WeekDay, WeekDayRaw, DayStatus } from '@/types'
import { DAYS_OF_WEEK, MONTHS_OF_YEAR } from '@/lib/constants'

/**
 * Normaliza una cadena YYYY-MM-DD a un objeto Date local sin desfases por timezones (UTC vs Local)
 */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Mapea el índice del día según JS (0=Dom, 1=Lun... 6=Sáb) al formato de app (0=Lun ... 6=Dom)
 */
function getNormalizedDayIndex(date: Date): number {
  const jsDay = date.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

/**
 * Evalúa el estado visual de un día del microciclo
 */
export function getDayStatus(day: WeekDay): DayStatus {
  if (day.isRest) return 'rest'
  if (day.isDone) return 'completed'
  if (day.isPartial) return 'partial'
  if (day.isMissed) return 'missed'

  return 'pending'
}

/**
 * Formatea una fecha a versión corta
 * Acepa tanto un objeto Date/ISO String como índices numéricos
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
 * Formatea una fecha a versión completa
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
  const month = MONTHS_OF_YEAR[dateObj.getMonth()]?.full ?? 'Enero'

  return `${day} · ${dateObj.getDate()} ${month} ${dateObj.getFullYear()}`
}

/**
 * Formatea el rango de fechas para la cabecera del calendario
 * @example formatDateRange('2026-08-10', '2026-08-16') -> "Ago 10–16"
 */
export function formatDateRange(startDateStr: string, endDateStr: string): string {
  const start = parseISODate(startDateStr)
  const end = parseISODate(endDateStr)
  const monthConfig = MONTHS_OF_YEAR[start.getMonth()]

  return `${monthConfig.short} ${start.getDate()}–${end.getDate()}`
}

/**
 * Transforma los datos crudos de la BD a objetos WeekDay listos para consumir en la UI
 */
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
    dayNumber: dateObj.getDate(), // ✅ Asignado a dayNumber (number)
    fullDate: rawDay.date, // ✅ 'YYYY-MM-DD'
    isToday: rawDay.isToday ?? isToday,
  }
}

/**
 * Obtiene el lunes de la semana para una fecha dada.
 */
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Lunes como primer día
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * Genera la estructura de 7 días (Lunes a Domingo) para cualquier semana.
 */
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
