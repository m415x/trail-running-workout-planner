/** Format only a persisted numeric value for an editable decimal field.
 * Draft strings are never reformatted here. No grouping or rounding.
 */
export function formatPersistedRegionalDecimal(
  value: number | null | undefined,
  locale: string,
): string {
  if (value == null) return ''
  const canonical = String(value)
  return locale === 'es' ? canonical.replace('.', ',') : canonical
}
