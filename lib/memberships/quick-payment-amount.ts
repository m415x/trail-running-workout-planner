/**
 * Parse an ungrouped decimal currency amount with up to two fractional
 * digits. Return integer minor units, never floating point rounded money.
 */
export function parseQuickPaymentAmountMinor(raw: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return null
  const [whole, fraction = ''] = raw.replace(',', '.').split('.')
  const wholeMinor = Number(whole) * 100
  const cents = Number(fraction.padEnd(2, '0'))
  const amount = wholeMinor + cents
  return Number.isSafeInteger(amount) ? amount : null
}
