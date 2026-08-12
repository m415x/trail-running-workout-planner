import { DAYS_OF_WEEK, MONTHS_OF_YEAR } from '@/utils/constants'

export function formatShortDate(dayIndex: number, dateNumber: number, monthIndex: number): string {
  const day = DAYS_OF_WEEK[dayIndex]?.medium ?? 'Lun'
  const month = MONTHS_OF_YEAR[monthIndex]?.short ?? 'Ene'

  return `${day}, ${dateNumber} ${month}`
}

export function formatFullDate(dayIndex: number, dateNumber: number, monthIndex: number): string {
  const day = DAYS_OF_WEEK[dayIndex]?.full ?? 'Lunes'
  const month = MONTHS_OF_YEAR[monthIndex]?.full ?? 'Enero'

  return `${day} · ${dateNumber} ${month} 2026`
}
