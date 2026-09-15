function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Inclusive 28-day athlete summary window ending on the supplied local day. */
export function athleteStatsSummaryPeriod(now: Date = new Date()) {
  const end = new Date(now)
  const start = new Date(now)
  start.setDate(start.getDate() - 27)

  return {
    startDate: localDateKey(start),
    endDate: localDateKey(end),
  }
}
