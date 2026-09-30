import { WeekDay, WeekDayRaw, DayStatus } from '@/types'

/**
 * Generates the Monday-Sunday range and a localized presentation label.
 */
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
