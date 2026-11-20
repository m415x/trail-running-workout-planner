import type Database from 'better-sqlite3'

import { readVerticalBlockJson, type VerticalBlockJsonReadResult } from './vertical-prescription-json'
import { resolveVerticalPrimaryObjective, type VerticalPrimaryObjective } from './vertical-prescription'

export type VerticalPrescriptionSqliteReadResult =
  | { status: 'not_found' }
  | {
      status: 'found'
      prescriptionId: string
      primaryObjective: VerticalPrimaryObjective | null
      elevationGain: number | null
      verticalBlock: VerticalBlockJsonReadResult
    }

/**
 * Read-only lookup for a previously authorized Session + microcycle scope.
 * Authorization must be enforced by the calling server boundary.
 * Neither legacy objectives nor session-wide elevation are inferred from a block.
 */
export function readVerticalPrescriptionSqlite(
  sqlite: Database.Database,
  scope: { sessionId: string; microcycleId: string },
): VerticalPrescriptionSqliteReadResult {
  if (!scope.sessionId?.trim() || !scope.microcycleId?.trim()) {
    throw new RangeError('Session and microcycle identity are required')
  }

  const row = sqlite.prepare(`
    SELECT id, primary_objective, elevation_gain, vertical_block_json
    FROM group_session_prescriptions
    WHERE session_id = ? AND microcycle_id = ? AND is_deleted = 0
  `).get(scope.sessionId, scope.microcycleId) as {
    id: string
    primary_objective: string | null
    elevation_gain: number | null
    vertical_block_json: string | null
  } | undefined

  if (!row) return { status: 'not_found' }

  return {
    status: 'found',
    prescriptionId: row.id,
    primaryObjective: resolveVerticalPrimaryObjective({
      primaryObjective: row.primary_objective as VerticalPrimaryObjective | null,
    }),
    elevationGain: row.elevation_gain,
    verticalBlock: readVerticalBlockJson(row.vertical_block_json),
  }
}
