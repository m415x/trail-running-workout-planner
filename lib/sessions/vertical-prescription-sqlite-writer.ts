import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

import { writeVerticalBlockJson } from './vertical-prescription-json'
import {
  resolveVerticalPrimaryObjective,
  resolveVerticalSessionElevationGain,
  type VerticalBlockV1,
  type VerticalPrimaryObjective,
} from './vertical-prescription'

interface VerticalPrescriptionWriteInput {
  sessionId: string
  microcycleId: string
  planId: string
  userId: string
  now: string
  /**
   * Caller-supplied authorization decision. The trusted server boundary must
   * enforce H2/H3/H4A independently before exposing this repository operation.
   */
  authorized: boolean
  primaryObjective: VerticalPrimaryObjective | null
  elevationGain: number | null
  verticalBlock: unknown
}

interface StoredVerticalFields {
  id: string
  elevation_gain: number | null
  primary_objective: string | null
  vertical_block_json: string | null
}

function auditFields(
  elevationGain: number | null,
  primaryObjective: string | null,
  verticalBlockJson: string | null,
) {
  return { elevationGain, primaryObjective, verticalBlockJson }
}

/**
 * Atomic manual correction to one existing, non-deleted prescription.
 * Both before/after audit and mutation share a single SQLite transaction.
 * No implicit generation, elevation inference or planning scope expansion.
 */
export function persistVerticalPrescriptionSqlite(
  sqlite: Database.Database,
  input: VerticalPrescriptionWriteInput,
): 'updated' | 'unchanged' {
  if (input.authorized !== true) {
    throw new Error('Vertical prescription authorization denied')
  }
  for (const value of [input.sessionId, input.microcycleId, input.planId, input.userId, input.now]) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new RangeError('Vertical prescription requires a complete trusted write scope')
    }
  }

  const primaryObjective = resolveVerticalPrimaryObjective({
    primaryObjective: input.primaryObjective,
  })
  const verticalBlock = input.verticalBlock as VerticalBlockV1 | null
  const verticalBlockJson = writeVerticalBlockJson(verticalBlock)
  if (verticalBlock !== null) {
    resolveVerticalSessionElevationGain({
      block: verticalBlock,
      proposedSessionElevationGainM: input.elevationGain,
    })
  } else if (
    input.elevationGain !== null && (
      !Number.isSafeInteger(input.elevationGain)
      || input.elevationGain < 0
      || input.elevationGain > 2_147_483_647
    )
  ) {
    throw new RangeError('Whole-session elevation is outside the supported range')
  }

  const update = sqlite.prepare(`
    UPDATE group_session_prescriptions
    SET elevation_gain = ?, primary_objective = ?, vertical_block_json = ?,
        updated_at = ?
    WHERE id = ? AND session_id = ? AND microcycle_id = ?
      AND is_deleted = 0 AND generation_ownership = 'manual'
  `)
  const insertAudit = sqlite.prepare(`
    INSERT INTO session_generation_modification_records (
      id, group_training_plan_id, session_id, prescription_id,
      action, ownership, generation_key, previous_value, new_value,
      changed_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'manual_modified', 'manual', NULL, ?, ?, ?, ?, ?)
  `)

  return sqlite.transaction((): 'updated' | 'unchanged' => {
    const existing = sqlite.prepare(`
      SELECT id, elevation_gain, primary_objective, vertical_block_json
      FROM group_session_prescriptions
      WHERE session_id = ? AND microcycle_id = ?
        AND is_deleted = 0 AND generation_ownership = 'manual'
    `).get(input.sessionId, input.microcycleId) as StoredVerticalFields | undefined
    if (!existing) {
      throw new Error('Vertical prescription scope unavailable or not manually editable')
    }

    const before = auditFields(
      existing.elevation_gain,
      existing.primary_objective,
      existing.vertical_block_json,
    )
    const after = auditFields(input.elevationGain, primaryObjective, verticalBlockJson)
    if (
      before.elevationGain === after.elevationGain
      && before.primaryObjective === after.primaryObjective
      && before.verticalBlockJson === after.verticalBlockJson
    ) {
      return 'unchanged'
    }

    const changed = update.run(
      input.elevationGain, primaryObjective, verticalBlockJson, input.now,
      existing.id, input.sessionId, input.microcycleId,
    )
    if (changed.changes !== 1) {
      throw new Error('Vertical prescription scope changed during update')
    }

    insertAudit.run(
      randomUUID(), input.planId, input.sessionId, existing.id,
      JSON.stringify(before), JSON.stringify(after),
      input.userId, input.now, input.now,
    )
    return 'updated'
  }).immediate()
}
