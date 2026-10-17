/**
 * Resolve a civil YYYY-MM-DD from a server-owned instant and an explicitly
 * selected IANA timezone. The caller must establish which regional timezone
 * is authoritative; this pure helper never derives it from client input.
 */
export function resolveBiometricCivilToday(instant: Date, timeZone: string): string {
  if (!Number.isFinite(instant.getTime())) {
    throw new RangeError('Invalid server instant')
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(instant)
  const value = (type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value
  const year = value('year')
  const month = value('month')
  const day = value('day')
  if (!year || !month || !day) {
    throw new RangeError('Unable to resolve regional civil date')
  }
  return `${year}-${month}-${day}`
}
