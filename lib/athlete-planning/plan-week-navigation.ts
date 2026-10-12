/** Pure civil-date navigation for the Athlete Plan URL. */
function parseCivilDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

function formatCivilDate(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/** The caller supplies today in the configured application time zone. */
export function resolveSelectedAthletePlanWeek(
  week: string | null,
  todayCivilDate: string,
): { status: 'resolved'; monday: string } | { status: 'invalid' } {
  const date = parseCivilDate(week ?? todayCivilDate)
  if (!date) return { status: 'invalid' }
  if (week !== null && date.getUTCDay() !== 1) return { status: 'invalid' }
  if (week === null) date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return { status: 'resolved', monday: formatCivilDate(date) }
}

/** Advance by whole civil weeks, independent of DST and runtime time zone. */
export function shiftAthletePlanWeek(monday: string, weeks: number): string {
  const date = parseCivilDate(monday)
  if (!date || date.getUTCDay() !== 1 || !Number.isSafeInteger(weeks)) {
    throw new RangeError('Expected an ISO civil Monday and an integer week offset')
  }
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return formatCivilDate(date)
}

/** Preserve existing locale path and query parameters when changing the selected week. */
export function athletePlanWeekHref(currentHref: string, monday: string): string {
  const date = parseCivilDate(monday)
  if (!date || date.getUTCDay() !== 1) throw new RangeError('Expected an ISO civil Monday')
  const [pathAndQuery, fragment] = currentHref.split('#', 2)
  const [pathname, query] = pathAndQuery.split('?', 2)
  const params = new URLSearchParams(query ?? '')
  params.set('week', monday)
  return `${pathname}?${params.toString()}${fragment === undefined ? '' : `#${fragment}`}`
}
