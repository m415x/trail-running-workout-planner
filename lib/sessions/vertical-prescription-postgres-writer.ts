import { randomUUID } from 'node:crypto'

import { writeVerticalBlockJson } from './vertical-prescription-json'
import {
  resolveVerticalPrimaryObjective,
  resolveVerticalSessionElevationGain,
  type VerticalBlockV1,
  type VerticalPrimaryObjective,
} from './vertical-prescription'

type PostgresTransactionQuery = (
  strings: TemplateStringsArray,
  ...parameters: unknown[]
) => Promise<readonly Record<string, unknown>[]>

interface VerticalPrescriptionPostgresWriteInput {
  sessionId: string
  microcycleId: string
  planId: string
  userId: string
  now: string
  /** Set only after authorization at the trusted server boundary. */
  authorized: boolean
  primaryObjective: VerticalPrimaryObjective | null
  elevationGain: number | null
  verticalBlock: unknown
}

function storedElevation(raw: unknown): number | null {
  if (raw === null) return null
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  if (typeof value !== 'number' || !Number.isSafeInteger(value)
    || value < 0 || value > 2_147_483_647) {
    throw new RangeError('Persisted whole-session elevation is invalid')
  }
  return value
}

/**
 * Caller owns the complete PostgreSQL transaction, including commit/rollback.
 * The trusted caller must authorize the Session, microcycle, Plan and actor;
 * this repository boundary also refuses non-manual or deleted prescriptions.
 * Do not call with a non-transactional connection.
 */
export async function persistVerticalPrescriptionPostgres(
  tx: PostgresTransactionQuery,
  input: VerticalPrescriptionPostgresWriteInput,
): Promise<'updated' | 'unchanged'> {
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
  } else if (input.elevationGain !== null
    && (!Number.isSafeInteger(input.elevationGain)
      || input.elevationGain < 0
      || input.elevationGain > 2_147_483_647)) {
    throw new RangeError('Whole-session elevation is outside the supported range')
  }

  const rows = await tx`
    SELECT id, elevation_gain AS "elevationGain",
      primary_objective AS "primaryObjective",
      vertical_block_json AS "verticalBlockJson"
    FROM group_session_prescriptions
    WHERE session_id = ${input.sessionId}
      AND microcycle_id = ${input.microcycleId}
      AND is_deleted = false
      AND generation_ownership = 'manual'
    FOR UPDATE
  `
  if (rows.length !== 1 || typeof rows[0].id !== 'string') {
    throw new Error('Vertical prescription scope unavailable or not manually editable')
  }
  const row = rows[0]
  const before = {
    elevationGain: storedElevation(row.elevationGain),
    primaryObjective: row.primaryObjective as string | null,
    verticalBlockJson: row.verticalBlockJson as string | null,
  }
  const after = {
    elevationGain: input.elevationGain,
    primaryObjective,
    verticalBlockJson,
  }
  if (before.elevationGain === after.elevationGain
    && before.primaryObjective === after.primaryObjective
    && before.verticalBlockJson === after.verticalBlockJson) {
    return 'unchanged'
  }

  const updated = await tx`
    UPDATE group_session_prescriptions
    SET elevation_gain = ${after.elevationGain},
      primary_objective = ${after.primaryObjective},
      vertical_block_json = ${after.verticalBlockJson},
      updated_at = ${input.now}
    WHERE id = ${row.id}
      AND session_id = ${input.sessionId}
      AND microcycle_id = ${input.microcycleId}
      AND is_deleted = false
      AND generation_ownership = 'manual'
    RETURNING id
  `
  if (updated.length !== 1 || updated[0].id !== row.id) {
    throw new Error('Vertical prescription scope changed during update')
  }

  await tx`
    INSERT INTO session_generation_modification_records (
      id, group_training_plan_id, session_id, prescription_id,
      action, ownership, generation_key, previous_value, new_value,
      changed_by_user_id, created_at, updated_at
    ) VALUES (
      ${randomUUID()}, ${input.planId}, ${input.sessionId}, ${row.id},
      'manual_modified', 'manual', NULL,
      ${JSON.stringify(before)}, ${JSON.stringify(after)},
      ${input.userId}, ${input.now}, ${input.now}
    )
  `
  return 'updated'
}
