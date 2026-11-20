import { readVerticalBlockJson, type VerticalBlockJsonReadResult } from './vertical-prescription-json'
import {
  resolveVerticalPrimaryObjective,
  type VerticalPrimaryObjective,
} from './vertical-prescription'

interface PersistedPostgresVerticalRow {
  id: string
  elevationGain: number | string | null
  primaryObjective: string | null
  verticalBlockJson: string | null
}

/** Minimal tagged-query contract, usable with a caller-owned postgres transaction. */
type VerticalPostgresQuery = (
  strings: TemplateStringsArray,
  ...parameters: unknown[]
) => Promise<readonly PersistedPostgresVerticalRow[]>

export type VerticalPrescriptionPostgresReadResult =
  | { status: 'not_found' }
  | {
      status: 'found'
      prescriptionId: string
      primaryObjective: VerticalPrimaryObjective | null
      elevationGain: number | null
      verticalBlock: VerticalBlockJsonReadResult
    }

/**
 * Read only from the already-authorized Session + microcycle scope.
 * Caller owns authorization and transaction lifetime; this helper cannot
 * infer missing legacy values or mutate unsupported/corrupt JSON.
 */
export async function readVerticalPrescriptionPostgres(
  tx: VerticalPostgresQuery,
  scope: { sessionId: string; microcycleId: string },
): Promise<VerticalPrescriptionPostgresReadResult> {
  if (!scope.sessionId?.trim() || !scope.microcycleId?.trim()) {
    throw new RangeError('Session and microcycle identity are required')
  }

  const rows = await tx`
    SELECT id, elevation_gain AS "elevationGain",
      primary_objective AS "primaryObjective",
      vertical_block_json AS "verticalBlockJson"
    FROM group_session_prescriptions
    WHERE session_id = ${scope.sessionId}
      AND microcycle_id = ${scope.microcycleId}
      AND is_deleted = false
  `
  const row = rows[0]
  if (!row) return { status: 'not_found' }

  const elevationGain = row.elevationGain === null
    ? null
    : typeof row.elevationGain === 'string'
      ? Number(row.elevationGain)
      : row.elevationGain
  if (elevationGain !== null && (
    !Number.isSafeInteger(elevationGain)
    || elevationGain < 0
    || elevationGain > 2_147_483_647
  )) {
    throw new RangeError('Persisted whole-session elevation is invalid')
  }

  return {
    status: 'found',
    prescriptionId: row.id,
    primaryObjective: resolveVerticalPrimaryObjective({
      primaryObjective: row.primaryObjective as VerticalPrimaryObjective | null,
    }),
    elevationGain,
    verticalBlock: readVerticalBlockJson(row.verticalBlockJson),
  }
}
