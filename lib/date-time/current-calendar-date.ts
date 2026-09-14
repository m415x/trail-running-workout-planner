/**
 * Returns the current calendar date in YYYY-MM-DD for an explicit IANA timezone.
 * Keeping this separate from legacy formatting avoids coupling status logic to
 * localized display helpers.
 */
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
