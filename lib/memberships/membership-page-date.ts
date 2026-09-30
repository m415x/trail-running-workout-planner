import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'

export function membershipPageCalendarDate(timeZone: string, now = new Date()) {
  return getCurrentISODateInTimeZone(timeZone, now)
}
