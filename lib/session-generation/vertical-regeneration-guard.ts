/** Regeneration may never reinterpret or remove unexpected explicit vertical data.
 * Only call on a generated row that the current unit would mutate. */
export function hasExplicitVerticalData(row: { primaryObjective?: unknown; verticalBlockJson?: unknown }): boolean {
  return row.primaryObjective != null || row.verticalBlockJson != null
}

export function assertGeneratedVerticalMutation(row: { primaryObjective?: unknown; verticalBlockJson?: unknown }): void {
  if (hasExplicitVerticalData(row)) throw new Error('reconciliation_conflict: generated prescription contains explicit vertical data')
}
