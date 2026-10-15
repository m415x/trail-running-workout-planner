import type postgres from 'postgres'

import type { GenerationExplanation } from './generation-explanation'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'
import { isWorkoutType } from '@/types/training/workout.types'

interface PostgresReconciliationInput {
  readonly planId: string
  readonly teamId: string
  readonly userId: string
  readonly proposal: SharedSessionGenerationResult
  readonly generationExplanations: ReadonlyMap<string, GenerationExplanation>
  /** Already-authorized Group set obtained from the trusted server boundary. */
  readonly authorizedGroupIds: ReadonlySet<string>
  readonly now: string
}

/**
 * PG-4/T5.4 first fail-closed writer boundary.
 *
 * Reads authoritative Plan, microcycle ancestry and proposed audience from
 * the caller-owned SERIALIZABLE TransactionSql. It must NOT be used as a
 * successful persistence callback until Session, prescription and audit
 * reconciliation are implemented and verified together.
 *
 * Never silently consume a review when the writer is incomplete.
 */
export async function reconcileAndPersistGeneratedSessionsPostgres(
  tx: postgres.TransactionSql,
  input: PostgresReconciliationInput,
): Promise<number> {
  const { planId, teamId, proposal, authorizedGroupIds } = input
  if (!planId?.trim() || !teamId?.trim() || !input.userId?.trim() ||
    !proposal || !Array.isArray(proposal.events)) {
    throw new Error('reconciliation_conflict: invalid PostgreSQL reconciliation input')
  }

  const plans = await tx<{ groupId: string }[]>`
    SELECT p.group_id AS "groupId"
    FROM group_training_plans AS p
    INNER JOIN athlete_groups AS g ON g.id = p.group_id
    INNER JOIN teams AS t ON t.id = g.team_id
    WHERE p.id = ${planId}
      AND g.team_id = ${teamId}
      AND p.is_deleted = false
      AND g.is_deleted = false
      AND t.is_deleted = false
    LIMIT 1
  `
  const plan = plans[0]
  if (!plan) throw new Error('reconciliation_conflict: plan unavailable')

  // An authorization decision for a different Plan Group never grants a
  // right to modify this Plan or its shared Session audience.
  const resultingGroupIds = proposal.events.flatMap(event =>
    (event.prescriptions ?? []).map(item => item.prescription?.groupId))
  const affectedGroups = new Set([plan.groupId, ...resultingGroupIds])
  if (![...affectedGroups].every(groupId =>
    typeof groupId === 'string' && authorizedGroupIds.has(groupId))) {
    throw new Error('reconciliation_conflict: affected group authorization changed')
  }

  const microcycleRows = await tx<{ id: string }[]>`
    SELECT mi.id
    FROM microcycles AS mi
    INNER JOIN mesocycles AS me
      ON me.id = mi.mesocycle_id AND me.is_deleted = false
    INNER JOIN macrocycles AS ma
      ON ma.id = me.macrocycle_id AND ma.is_deleted = false
    WHERE ma.group_training_plan_id = ${planId}
      AND mi.is_deleted = false
  `
  const validMicrocycleIds = new Set(microcycleRows.map(row => row.id))
  for (const event of proposal.events) {
    if (!event.sharedEventKey?.trim() ||
      !event.session?.title?.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(event.session?.date ?? '') ||
      !isWorkoutType(event.session?.type) || !Array.isArray(event.prescriptions)) {
      throw new Error('La propuesta contiene un evento incompleto.')
    }
    for (const item of event.prescriptions) {
      if (item.prescription.groupId !== plan.groupId ||
        !validMicrocycleIds.has(item.prescription.microcycleId)) {
        throw new Error('La propuesta contiene una prescripción fuera de la planificación.')
      }
    }
  }

  // Explicit fail-closed guard: subsequent PG-4 steps must implement ALL
  // reconciliation, protected record preservation and audit atomically.
  throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
}
