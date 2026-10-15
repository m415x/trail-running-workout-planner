import { randomUUID } from 'node:crypto'
import type postgres from 'postgres'

import type { GenerationExplanation } from './generation-explanation'
import { resolveGenerationExplanationSnapshot } from './generation-explanation-persistence'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'
import { isWorkoutType } from '@/types/training/workout.types'


// PostgreSQL numeric columns may deserialize as strings. Compare the domain
// values after normalizing nullable fields, not the transport representation.
function canonicalAuditValue(value: Record<string, unknown>): string {
  const normalize = (key: string, raw: unknown): unknown => {
    if (raw === undefined) return null
    if (raw === null) return null
    if (['distanceKm', 'durationMin', 'elevationGain', 'referencePercentage']
      .includes(key) && (typeof raw === 'number' || typeof raw === 'string')) {
      const numeric = Number(raw)
      return Number.isFinite(numeric) ? numeric : raw
    }
    return raw
  }
  return JSON.stringify(Object.fromEntries(
    Object.entries(value).map(([key, raw]) => [key, normalize(key, raw)]),
  ))
}

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
 * PG-4/T5.4 limited create, replacement and obsolete generated removal slice.
 *
 * Reads authoritative Plan, microcycle ancestry, previous protected records
 * and their complete current Group audience on the caller-owned transaction.
 * Shared Session retirement preserves other Plans' live prescriptions;
 * other multi-plan reconciliation and protected-key collisions remain
 * fail closed. This is not the production-complete writer.
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
  // reconciliation read-set; protected ownership never authorizes mutation.
  const preexisting = await tx<{
    id: string
    sessionId: string
    groupId: string
    ownership: string
    sessionOwnership: string
    sessionTeamId: string
    generationKey: string | null
  }[]>`
    SELECT gp.id, gp.session_id AS "sessionId",
      gp.group_id AS "groupId",
      gp.generation_ownership AS ownership,
      s.generation_ownership AS "sessionOwnership",
      s.team_id AS "sessionTeamId",
      gp.generation_key AS "generationKey"
    FROM group_session_prescriptions AS gp
    INNER JOIN sessions AS s ON s.id = gp.session_id
    INNER JOIN microcycles AS mi ON mi.id = gp.microcycle_id
    INNER JOIN mesocycles AS me ON me.id = mi.mesocycle_id
    INNER JOIN macrocycles AS ma ON ma.id = me.macrocycle_id
    WHERE ma.group_training_plan_id = ${planId}
      AND gp.is_deleted = false
  `
  const protectedSessionIds = new Set<string>()
  const proposalPrescriptionKeys = new Set(proposal.events.flatMap(event =>
    event.prescriptions.map(item => item.generationKey)))
  const generatedByKey = new Map<string, (typeof preexisting)[number]>()
  for (const row of preexisting) {
    if (row.sessionTeamId !== teamId) {
      throw new Error('reconciliation_conflict: event Team ownership changed')
    }
    if (!authorizedGroupIds.has(row.groupId)) {
      throw new Error('reconciliation_conflict: affected group authorization changed')
    }
    if (row.ownership === 'generated' && row.sessionOwnership === 'generated') {
      if (!row.generationKey || generatedByKey.has(row.generationKey)) {
        throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
      }
      generatedByKey.set(row.generationKey, row)
    } else if (
      ['manual', 'generated_modified'].includes(row.ownership) &&
      ['manual', 'generated_modified'].includes(row.sessionOwnership)
    ) {
      if (row.generationKey && proposalPrescriptionKeys.has(row.generationKey)) {
        throw new Error('reconciliation_conflict: protected generation key collision')
      }
      protectedSessionIds.add(row.sessionId)
    } else {
      throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
    }
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
  const preservedCount = preexisting.length - generatedByKey.size + protectedSessionIds.size
  const obsoleteGenerated = [...generatedByKey.values()].filter(row =>
    !proposalPrescriptionKeys.has(row.generationKey!))
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
  // A newly attached prescription must not reuse a generation key already
  // claimed outside this Plan, even if the target Session is authorized.
  const freshKeys = [...seenPrescriptions].filter(key => !generatedByKey.has(key))
  if (freshKeys.length > 0) {
    const claimed = await tx<{generationKey:string}[]>`
      SELECT generation_key AS "generationKey"
      FROM group_session_prescriptions
      WHERE generation_key IN ${tx(freshKeys)}
    `
    if (claimed.length > 0) {
      throw new Error('reconciliation_conflict: generation key already claimed')
    }
  }
  const keys = [...seenEvents]
  const existingSessions = keys.length === 0 ? [] : await tx<{
    id: string
    sharedEventKey: string
    teamId: string
    ownership: string
    date: string
    title: string
    type: string
    workoutId: string | null
    locationKey: string | null
    trackPath: string | null
    structure: unknown
    notes: string | null
  }[]>`
    SELECT id, shared_event_key AS "sharedEventKey", team_id AS "teamId",
      generation_ownership AS ownership, date, title, type,
      workout_id AS "workoutId", location_key AS "locationKey",
      track_path AS "trackPath", structure, notes
    FROM sessions WHERE shared_event_key IN ${tx(keys)}
  `
  const byEventKey = new Map(existingSessions.map(row => [row.sharedEventKey, row]))
  for (const row of existingSessions) {
    if (row.teamId !== teamId) {
      throw new Error('reconciliation_conflict: event Team ownership changed')
    }
    if (row.ownership !== 'generated') {
      throw new Error('reconciliation_conflict: protected shared event collision')
    }
    const related = [...generatedByKey.values()].filter(p => p.sessionId === row.id)
    if (related.length === 0) {
      throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
    }
    const audience = await tx<{
      id: string
      groupId: string
      teamId: string
      groupActive: boolean
      ownership: string
    }[]>`
      SELECT gp.id, gp.group_id AS "groupId", g.team_id AS "teamId",
        (NOT g.is_deleted) AS "groupActive",
        gp.generation_ownership AS ownership
      FROM group_session_prescriptions AS gp
      INNER JOIN athlete_groups AS g ON g.id = gp.group_id
      WHERE gp.session_id = ${row.id} AND gp.is_deleted = false
    `
    // Reauthorize the COMPLETE shared-Session audience in the same
    // transaction, including prescriptions owned by other Plans.
    if (audience.some(p => !authorizedGroupIds.has(p.groupId))) {
      throw new Error('reconciliation_conflict: affected group authorization changed')
    }
    if (audience.some(p => p.teamId !== teamId || !p.groupActive)) {
      throw new Error('reconciliation_conflict: event Team ownership changed')
    }
    // This slice can update the common generated Session only if other
    // Plans' prescriptions remain generated and untouched. Never silently
    // overwrite the shared header of an athlete/coach-protected prescription.
    if (audience.some(p => !related.some(r => r.id === p.id) &&
      p.ownership !== 'generated')) {
      throw new Error('reconciliation_conflict: protected shared event collision')
    }
  }
  for (const row of generatedByKey.values()) {
    if (proposalPrescriptionKeys.has(row.generationKey!) &&
      !existingSessions.some(event => event.id === row.sessionId)) {
      throw new Error('reconciliation_conflict: PostgreSQL writer not yet implemented')
    }
  }

  // Validate the complete audience before any INSERT, UPDATE or audit write.
  // Account for every active prescription before deciding whether a Session survives.
  const obsoleteSessionIds = [...new Set(obsoleteGenerated.map(row => row.sessionId))]
  const obsoleteSessions = new Map<string, {
    id: string
    title: string
    date: string
    type: string
    ownership: string
    sharedEventKey: string | null
    workoutId: string | null
    locationKey: string | null
    trackPath: string | null
    structure: unknown
    notes: string | null
  }>()
  for (const sessionId of obsoleteSessionIds) {
    const sessions = await tx<{
      id: string; title: string; date: string; type: string
      ownership: string; sharedEventKey: string | null
      workoutId: string | null; locationKey: string | null
      trackPath: string | null; structure: unknown; notes: string | null
    }[]>`
      SELECT id,title,date,type,generation_ownership AS ownership,
        shared_event_key AS "sharedEventKey",workout_id AS "workoutId",
        location_key AS "locationKey",track_path AS "trackPath",
        structure,notes FROM sessions
      WHERE id = ${sessionId} AND team_id = ${teamId}
        AND is_deleted = false
    `
    const session = sessions[0]
    if (!session || session.ownership !== 'generated') {
      throw new Error('reconciliation_conflict: obsolete generated Session collision')
    }
    // A Session can remain in the new proposal while only one of its
    // generated prescriptions is obsolete. Retire the prescription, but
    // preserve the Session while any active prescription still references it.
    const audience = await tx<{id: string; groupId: string}[]>`
      SELECT id,group_id AS "groupId" FROM group_session_prescriptions
      WHERE session_id = ${sessionId} AND is_deleted = false
    `
    if (audience.some(row => !authorizedGroupIds.has(row.groupId))) {
      throw new Error('reconciliation_conflict: affected group authorization changed')
    }
    // The complete audience is authorized. Retire only this Plan's generated
    // prescriptions; leave the shared Session active for any other live group.
    // Never mutate or audit a surviving group's prescription here.
    obsoleteSessions.set(sessionId, session)
  }

  for (const event of proposal.events) {
    const previousEvent = byEventKey.get(event.sharedEventKey)
    const sessionId = previousEvent?.id ?? randomUUID()
    const values = event.session
    const sessionAudit = {
      sourceTemplateId: values.sourceTemplateId,
      date: values.date, title: values.title, type: values.type,
      locationKey: values.locationKey, trackPath: values.trackPath,
      structure: values.structure, notes: values.notes,
    }
    const previousSessionAudit = previousEvent ? {
      sourceTemplateId: previousEvent.workoutId, date: previousEvent.date,
      title: previousEvent.title, type: previousEvent.type,
      locationKey: previousEvent.locationKey, trackPath: previousEvent.trackPath,
      structure: previousEvent.structure, notes: previousEvent.notes,
    } : null
    const eventChanged = previousSessionAudit === null ||
      canonicalAuditValue(previousSessionAudit) !== canonicalAuditValue(sessionAudit)
    if (previousEvent && eventChanged) {
      await tx`
        UPDATE sessions SET workout_id = ${values.sourceTemplateId},
          date = ${values.date}, title = ${values.title}, type = ${values.type},
          location_key = ${values.locationKey}, track_path = ${values.trackPath},
          structure = ${values.structure === null ? null : JSON.stringify(values.structure)}::jsonb,
          notes = ${values.notes}, is_deleted = false, updated_at = ${input.now}
        WHERE id = ${sessionId} AND team_id = ${teamId}
          AND generation_ownership = 'generated'
      `
    } else if (!previousEvent) {
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
    }
    if (eventChanged) {
    await tx`
      INSERT INTO session_generation_modification_records (
        id, group_training_plan_id, session_id, action, ownership,
        generation_key, previous_value, new_value, changed_by_user_id,
        created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${planId}, ${sessionId},
        ${previousEvent ? 'generated_updated' : 'generated_created'},
        'generated', ${event.sharedEventKey},
        ${previousSessionAudit === null ? null : JSON.stringify(previousSessionAudit)},
        ${JSON.stringify(sessionAudit)}, ${input.userId}, ${input.now}, ${input.now}
      )
    `
    }
    for (const item of event.prescriptions) {
      const existingPrescription = generatedByKey.get(item.generationKey)
      if (existingPrescription && existingPrescription.sessionId !== sessionId) {
        throw new Error('reconciliation_conflict: prescription belongs to another Session')
      }
      const prescriptionId = existingPrescription?.id ?? randomUUID()
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
      const priorPrescription = existingPrescription ? await tx<{
        groupId: string
        microcycleId: string
        distanceKm: number | null
        durationMin: number | null
        elevationGain: number | null
        intensityMethod: string | null
        zone: string | null
        referencePercentage: number | null
        notes: string | null
      }[]>`
        SELECT group_id AS "groupId", microcycle_id AS "microcycleId",
          distance_km AS "distanceKm", duration_min AS "durationMin",
          elevation_gain AS "elevationGain", intensity_method AS "intensityMethod",
          zone, reference_percentage AS "referencePercentage", notes
        FROM group_session_prescriptions WHERE id = ${prescriptionId}
      ` : []
      const prescriptionAudit = {
        groupId: data.groupId, microcycleId: data.microcycleId,
        distanceKm: data.distanceKm ?? null, durationMin: data.durationMin ?? null,
        elevationGain: data.elevationGain ?? null, intensityMethod: data.intensityMethod,
        zone: data.zone, referencePercentage: data.referencePercentage ?? null,
        notes: data.notes,
      }
      const prescriptionChanged = !existingPrescription ||
        !priorPrescription[0] ||
        canonicalAuditValue(priorPrescription[0]) !== canonicalAuditValue(prescriptionAudit)
      if (existingPrescription && prescriptionChanged) {
        await tx`
          UPDATE group_session_prescriptions
          SET group_id = ${data.groupId}, microcycle_id = ${data.microcycleId},
            distance_km = ${data.distanceKm ?? null},
            duration_min = ${data.durationMin ?? null},
            elevation_gain = ${data.elevationGain ?? null},
            intensity_method = ${data.intensityMethod}, zone = ${data.zone},
            reference_percentage = ${data.referencePercentage}, notes = ${data.notes},
            is_deleted = false, updated_at = ${input.now}
          WHERE id = ${prescriptionId} AND session_id = ${sessionId}
            AND generation_ownership = 'generated'
        `
      } else if (!existingPrescription) {
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
      }
      if (prescriptionChanged) {
      await tx`
        INSERT INTO session_generation_modification_records (
          id, group_training_plan_id, session_id, prescription_id,
          action, ownership, generation_key, generation_explanation,
          previous_value, new_value, changed_by_user_id, created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${planId}, ${sessionId}, ${prescriptionId},
          ${existingPrescription ? 'generated_updated' : 'generated_created'},
          'generated', ${item.generationKey},
          ${explanation === null ? null : JSON.stringify(explanation)}::jsonb,
          ${existingPrescription ? JSON.stringify(priorPrescription[0]) : null},
          ${JSON.stringify(prescriptionAudit)}, ${input.userId},
          ${input.now}, ${input.now}
        )
      `      }

    }
  }
  // Obsolete generated prescriptions and their now-unreferenced Sessions
  // are retired, never hard-deleted. Both removal audit records carry the
  // previous values and belong to the same caller-owned transaction.
  for (const old of obsoleteGenerated) {
    const before = await tx<{
      groupId: string; microcycleId: string; distanceKm: number | null
      durationMin: number | null; elevationGain: number | null
      intensityMethod: string | null; zone: string | null
      referencePercentage: number | null; notes: string | null
    }[]>`
      SELECT group_id AS "groupId",microcycle_id AS "microcycleId",
        distance_km AS "distanceKm",duration_min AS "durationMin",
        elevation_gain AS "elevationGain",intensity_method AS "intensityMethod",
        zone,reference_percentage AS "referencePercentage",notes
      FROM group_session_prescriptions
      WHERE id = ${old.id} AND generation_ownership = 'generated'
        AND is_deleted = false
    `
    if (before.length !== 1) {
      throw new Error('reconciliation_conflict: obsolete prescription changed')
    }
    await tx`
      UPDATE group_session_prescriptions SET is_deleted = true, updated_at = ${input.now}
      WHERE id = ${old.id} AND generation_ownership = 'generated'
        AND is_deleted = false
    `
    await tx`
      INSERT INTO session_generation_modification_records (
        id,group_training_plan_id,session_id,prescription_id,
        action,ownership,generation_key,previous_value,new_value,
        changed_by_user_id,created_at,updated_at
      ) VALUES (
        ${randomUUID()},${planId},${old.sessionId},${old.id},
        'generated_removed','generated',${old.generationKey},
        ${JSON.stringify(before[0])},null,${input.userId},${input.now},${input.now}
      )
    `
  }
  for (const [sessionId, old] of obsoleteSessions) {
    const remaining = await tx<{n: number}[]>`
      SELECT count(*)::integer AS n FROM group_session_prescriptions
      WHERE session_id = ${sessionId} AND is_deleted = false
    `
    if (remaining[0]?.n !== 0) {
      // Another Plan still owns a live prescription in this shared Session.
      // Its event cannot be retired or audited as removed by this Plan.
      continue
    }
    await tx`
      UPDATE sessions SET is_deleted = true,updated_at = ${input.now}
      WHERE id = ${sessionId} AND generation_ownership = 'generated'
        AND is_deleted = false
    `
    const before = {
      sourceTemplateId: old.workoutId,
      date: old.date,title: old.title,type: old.type,
      locationKey: old.locationKey,trackPath: old.trackPath,
      structure: old.structure,notes: old.notes,
    }
    await tx`
      INSERT INTO session_generation_modification_records (
        id,group_training_plan_id,session_id,action,ownership,
        generation_key,previous_value,new_value,changed_by_user_id,
        created_at,updated_at
      ) VALUES (
        ${randomUUID()},${planId},${sessionId},'generated_removed',
        'generated',${old.sharedEventKey},${JSON.stringify(before)},null,
        ${input.userId},${input.now},${input.now}
      )
    `
  }
  return preservedCount
}
