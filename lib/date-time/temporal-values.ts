export interface CalendarDateValue {
  kind: 'calendar_date'
  value: string
}

export interface LocalPlannedDateTimeValue {
  kind: 'local_planned_date_time'
  date: string
  time: string
  timeZone: string
}

export interface AbsoluteInstantValue {
  kind: 'absolute_instant'
  value: string
}

export function calendarDate(value: string): CalendarDateValue {
  return {
    kind: 'calendar_date',
    value,
  }
}

export function localPlannedDateTime({
  date,
  time,
  timeZone,
}: {
  date: string
  time: string
  timeZone: string
}): LocalPlannedDateTimeValue {
  return {
    kind: 'local_planned_date_time',
    date,
    time,
    timeZone,
  }
}

export function absoluteInstant(value: string): AbsoluteInstantValue {
  return {
    kind: 'absolute_instant',
    value,
  }
}
