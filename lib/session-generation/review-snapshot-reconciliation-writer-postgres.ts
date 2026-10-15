import { randomUUID } from 'node:crypto'
import type postgres from 'postgres'

import type { GenerationExplanation } from './generation-explanation'
import { resolveGenerationExplanationSnapshot } from './generation-explanation-persistence'
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
 * PG-4/T5.4 limited CREATE-only writer slice.
 *
 * Reads authoritative Plan, microcycle ancestry, previous protected records
 * and their complete current Group audience on the caller-owned transaction.
 * Existing generated records and matching shared keys remain unsupported and
 * fail closed. This is not the production-complete reconciliation writer.
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

  const plans = await tx<{ groupId: string; planningCohortId: string | null }[]>`
    SELECT p.group_id AS "groupId", p.planning_cohort_id AS "planningCohortId"
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

  // Every previous active prescription in this Plan participates in the
  // reconciliation read-set. Only protected rows can coexist with this
  // CREATE-only slice; generated rows require the still-pending replacement
  // and obsolete-record lifecycle. Never silently skip those mutations.
  if (proposal.events.length === 0) {
    throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
  }
  const preexisting = await tx<{
    id: string
    sessionId: string
    groupId: string
    ownership: string
    sessionOwnership: string
    sessionTeamId: string
  }[]>`
    SELECT gp.id, gp.session_id AS "sessionId",
      gp.group_id AS "groupId",
      gp.generation_ownership AS ownership,
      s.generation_ownership AS "sessionOwnership",
      s.team_id AS "sessionTeamId"
    FROM group_session_prescriptions AS gp
    INNER JOIN sessions AS s ON s.id = gp.session_id
    INNER JOIN microcycles AS mi ON mi.id = gp.microcycle_id
    INNER JOIN mesocycles AS me ON me.id = mi.mesocycle_id
    INNER JOIN macrocycles AS ma ON ma.id = me.macrocycle_id
    WHERE ma.group_training_plan_id = ${planId}
      AND gp.is_deleted = false
  `
  const protectedSessionIds = new Set<string>()
  for (const row of preexisting) {
    if (row.sessionTeamId !== teamId) {
      throw new Error('reconciliation_conflict: event Team ownership changed')
    }
    if (!authorizedGroupIds.has(row.groupId)) {
      throw new Error('reconciliation_conflict: affected group authorization changed')
    }
    if (!['manual', 'generated_modified'].includes(row.ownership) ||
      !['manual', 'generated_modified'].includes(row.sessionOwnership)) {
      throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
    }
    protectedSessionIds.add(row.sessionId)
  }
  // A protected shared Session may also have live prescriptions under other
  // plans. Re-read that complete audience before accepting the new write set.
  if (protectedSessionIds.size > 0) {
    const otherAudience = await tx<{ groupId: string }[]>`
      SELECT DISTINCT group_id AS "groupId"
      FROM group_session_prescriptions
      WHERE session_id IN ${tx([...protectedSessionIds])}
        AND is_deleted = false
    `
    if (!otherAudience.every(row => authorizedGroupIds.has(row.groupId))) {
      throw new Error('reconciliation_conflict: affected group authorization changed')
    }
  }
  const preservedCount = preexisting.length + protectedSessionIds.size
  const seenEvents = new Set<string>()
  const seenPrescriptions = new Set<string>()
  for (const event of proposal.events) {
    if (seenEvents.has(event.sharedEventKey) || event.prescriptions.length === 0) {
      throw new Error('reconciliation_conflict: invalid or duplicate proposed event')
    }
    seenEvents.add(event.sharedEventKey)
    for (const prescription of event.prescriptions) {
      if (!prescription.generationKey?.trim() ||
        seenPrescriptions.has(prescription.generationKey)) {
        throw new Error('reconciliation_conflict: invalid or duplicate generation key')
      }
      seenPrescriptions.add(prescription.generationKey)
    }
  }
  const keys = [...seenEvents]
  const existingSessions = await tx<{ id: string }[]>`
    SELECT id FROM sessions WHERE shared_event_key IN ${tx(keys)}
  `
  if (existingSessions.length !== 0) {
    throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
  }

  for (const event of proposal.events) {
    const sessionId = randomUUID()
    const values = event.session
    await tx`
      INSERT INTO sessions (
        id, team_id, workout_id, date, title, type, location_key,
        track_path, structure, notes, generation_ownership, shared_event_key,
        created_at, updated_at
      ) VALUES (
        ${sessionId}, ${teamId}, ${values.sourceTemplateId},
        ${values.date}, ${values.title}, ${values.type},
        ${values.locationKey}, ${values.trackPath},
        ${values.structure === null ? null : JSON.stringify(values.structure)}::jsonb,
        ${values.notes}, 'generated', ${event.sharedEventKey},
        ${input.now}, ${input.now}
      )
    `
    const sessionAudit = {
      sourceTemplateId: values.sourceTemplateId,
      date: values.date, title: values.title, type: values.type,
      locationKey: values.locationKey, trackPath: values.trackPath,
      structure: values.structure, notes: values.notes,
    }
    await tx`
      INSERT INTO session_generation_modification_records (
        id, group_training_plan_id, session_id, action, ownership,
        generation_key, previous_value, new_value, changed_by_user_id,
        created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${planId}, ${sessionId}, 'generated_created',
        'generated', ${event.sharedEventKey}, null,
        ${JSON.stringify(sessionAudit)}, ${input.userId}, ${input.now}, ${input.now}
      )
    `
    for (const item of event.prescriptions) {
      const prescriptionId = randomUUID()
      const data = item.prescription
      const expectedScope: GenerationExplanation['planningScope'] =
        plan.planningCohortId === null
          ? {
              kind: 'base', groupTrainingPlanId: planId, groupId: plan.groupId,
              planningCohortId: null, microcycleId: data.microcycleId,
            }
          : {
              kind: 'variant', groupTrainingPlanId: planId, groupId: plan.groupId,
              planningCohortId: plan.planningCohortId, microcycleId: data.microcycleId,
            }
      const explanation = resolveGenerationExplanationSnapshot({
        snapshots: new Map(input.generationExplanations),
        generationKey: item.generationKey,
        expectedScope,
      })
      await tx`
        INSERT INTO group_session_prescriptions (
          id, session_id, group_id, microcycle_id, distance_km,
          duration_min, elevation_gain, intensity_method, zone,
          reference_percentage, notes, generation_ownership, generation_key,
          created_at, updated_at
        ) VALUES (
          ${prescriptionId}, ${sessionId}, ${data.groupId}, ${data.microcycleId},
          ${data.distanceKm ?? null}, ${data.durationMin ?? null}, ${data.elevationGain ?? null},
          ${data.intensityMethod}, ${data.zone},
          ${data.referencePercentage}, ${data.notes}, 'generated',
          ${item.generationKey}, ${input.now}, ${input.now}
        )
      `
      const prescriptionAudit = {
        groupId: data.groupId, microcycleId: data.microcycleId,
        distanceKm: data.distanceKm, durationMin: data.durationMin,
        elevationGain: data.elevationGain, intensityMethod: data.intensityMethod,
        zone: data.zone, referencePercentage: data.referencePercentage,
        notes: data.notes,
      }
      await tx`
        INSERT INTO session_generation_modification_records (
          id, group_training_plan_id, session_id, prescription_id,
          action, ownership, generation_key, generation_explanation,
          previous_value, new_value, changed_by_user_id, created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${planId}, ${sessionId}, ${prescriptionId},
          'generated_created', 'generated', ${item.generationKey},
          ${explanation === null ? null : JSON.stringify(explanation)}::jsonb,
          null, ${JSON.stringify(prescriptionAudit)}, ${input.userId},
          ${input.now}, ${input.now}
        )
      `
    }
  }
  return preservedCount
}
