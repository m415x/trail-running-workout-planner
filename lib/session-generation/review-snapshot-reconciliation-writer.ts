import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import {
  groupSessionPrescriptions, groupTrainingPlans, athleteGroups,
  macrocycles, mesocycles, microcycles, sessions,
  sessionGenerationModificationRecords,
} from '@/db/schema'
import { reconcileSessionGeneration } from './session-regeneration'
import { resolveGenerationExplanationSnapshot } from './generation-explanation-persistence'
import type { GenerationExplanation } from './generation-explanation'
import { isWorkoutType } from '@/types/training/workout.types'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

interface WriteInput {
  readonly planId: string
  readonly teamId: string
  readonly userId: string
  readonly proposal: SharedSessionGenerationResult
  readonly generationExplanations: Map<string, GenerationExplanation>
  readonly authorizedGroupIds: ReadonlySet<string>
  readonly now: string
  /** For the outer snapshot CAS IMMEDIATE transaction on the SAME SQLite connection. */
  readonly withinExistingTransaction?: boolean
}

/**
 * Shared generation reconciliation writer. All authoritative SQL reads,
 * reconciliation decisions, and writes execute in one synchronous transaction.
 * The caller resolves async H2/H3/H4A before entry; a newly affected group
 * not in the preauthorized set aborts the transaction fail-closed.
 */
export function reconcileAndPersistGeneratedSessionsSqlite(input: WriteInput): number {
  const { planId, teamId, userId, proposal, generationExplanations, authorizedGroupIds, now } = input
  const run = (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]): number => {
    const plan = tx.select({
      id: groupTrainingPlans.id,
      groupId: groupTrainingPlans.groupId,
      planningCohortId: groupTrainingPlans.planningCohortId,
    })
      .from(groupTrainingPlans)
      .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
      .where(and(
        eq(groupTrainingPlans.id, planId),
        eq(athleteGroups.teamId, teamId),
        eq(groupTrainingPlans.isDeleted, false),
      ))
      .get()
    if (!plan) throw new Error('reconciliation_conflict: plan unavailable')

    const planMicrocycles = tx.select({ id: microcycles.id })
      .from(microcycles)
      .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
      .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
      .where(and(
        eq(macrocycles.groupTrainingPlanId, planId),
        eq(microcycles.isDeleted, false),
      ))
      .all()
    const microcycleIds = new Set(planMicrocycles.map(({ id }) => id))
    validateProposalScope(proposal, plan.groupId, microcycleIds)

    const persistedPrescriptions = planMicrocycles.length === 0 ? [] : tx.select()
      .from(groupSessionPrescriptions)
      .where(and(
        inArray(groupSessionPrescriptions.microcycleId, [...microcycleIds]),
        eq(groupSessionPrescriptions.isDeleted, false),
      ))
      .all()
    const proposedEventKeys = proposal.events.map(({ sharedEventKey }) => sharedEventKey)
    const relatedSessionIds = [...new Set(persistedPrescriptions.map(({ sessionId }) => sessionId))]
    const persistedEventsById = relatedSessionIds.length === 0 ? [] : tx.select()
      .from(sessions)
      .where(inArray(sessions.id, relatedSessionIds))
      .all()
    const persistedEventsByKey = proposedEventKeys.length === 0 ? [] : tx.select()
      .from(sessions)
      .where(inArray(sessions.sharedEventKey, proposedEventKeys))
      .all()
    const persistedEvents = [...new Map(
      [...persistedEventsById, ...persistedEventsByKey].map((event) => [event.id, event]),
    ).values()]

    // A shared session can belong to other plans. Check every current group,
    // including prescriptions outside the source plan, before reconciliation.
    const affectedSessionIds = [...new Set(persistedEvents.map((event) => event.id))]
    const allCurrentPrescriptions = affectedSessionIds.length === 0 ? [] : await tx.select({
      groupId: groupSessionPrescriptions.groupId,
    }).from(groupSessionPrescriptions)
      .where(and(
        inArray(groupSessionPrescriptions.sessionId, affectedSessionIds),
        eq(groupSessionPrescriptions.isDeleted, false),
      )).all()
    const priorGroupIds = allCurrentPrescriptions.map(({ groupId }) => groupId)
    const resultingGroupIds = proposal.events.flatMap((event) =>
      event.prescriptions.map((prescription) => prescription.prescription.groupId))
    const allGroups = [...new Set([plan.groupId, ...priorGroupIds, ...resultingGroupIds])]
    if (!allGroups.every(groupId => authorizedGroupIds.has(groupId))) {
      throw new Error('reconciliation_conflict: affected group authorization changed')
    }
    // Also reject collisions with events owned by another Team.
    if (persistedEvents.some(event => event.teamId !== teamId)) {
      throw new Error('reconciliation_conflict: event Team ownership changed')
    }

    const reconciliation = reconcileSessionGeneration({
      proposal,
      existingEvents: persistedEvents.map((event) => ({
        id: event.id,
        provenance: event.generationOwnership === 'manual'
          ? { ownership: 'manual', sharedEventKey: null }
          : { ownership: event.generationOwnership, sharedEventKey: event.sharedEventKey! },
      })),
      existingPrescriptions: persistedPrescriptions.map((prescription) => ({
        id: prescription.id,
        sessionId: prescription.sessionId,
        provenance: prescription.generationOwnership === 'manual'
          ? { ownership: 'manual', generationKey: null }
          : { ownership: prescription.generationOwnership, generationKey: prescription.generationKey! },
      })),
    })

    const eventIdByKey = new Map(
      persistedEvents.flatMap((event) => event.sharedEventKey ? [[event.sharedEventKey, event.id]] : []),
    )
    const eventKeyByGenerationKey = new Map<string, string>()
    for (const event of proposal.events) {
      for (const prescription of event.prescriptions) {
        eventKeyByGenerationKey.set(prescription.generationKey, event.sharedEventKey)
      }
    }


      for (const operation of reconciliation.events) {
        const values = operation.proposal.session
        const id = operation.existingId ?? randomUUID()
        const previousEvent = operation.existingId
          ? persistedEvents.find((event) => event.id === operation.existingId) ?? null
          : null
        eventIdByKey.set(operation.proposal.sharedEventKey, id)
        if (operation.action === 'create') {
          tx.insert(sessions).values({
            id, teamId: teamId, workoutId: values.sourceTemplateId,
            date: values.date, title: values.title, type: values.type,
            locationKey: values.locationKey, trackPath: values.trackPath,
            structure: values.structure, notes: values.notes,
            generationOwnership: 'generated', sharedEventKey: operation.proposal.sharedEventKey,
            createdAt: now, updatedAt: now,
          }).run()
        } else {
          tx.update(sessions).set({
            workoutId: values.sourceTemplateId, date: values.date, title: values.title,
            type: values.type, locationKey: values.locationKey, trackPath: values.trackPath,
            structure: values.structure, notes: values.notes, isDeleted: false, updatedAt: now,
          }).where(eq(sessions.id, id)).run()
        }
        const previousAuditValue = previousEvent ? sessionAuditValue(previousEvent) : null
        const nextAuditValue = sessionAuditValue(values)
        if (operation.action === 'create' || !sameAuditValue(previousAuditValue, nextAuditValue)) {
          tx.insert(sessionGenerationModificationRecords).values({
            id: randomUUID(), groupTrainingPlanId: planId, sessionId: id,
            action: operation.action === 'create' ? 'generated_created' : 'generated_updated',
            ownership: 'generated', generationKey: operation.proposal.sharedEventKey,
            previousValue: previousAuditValue ? serializeAuditValue(previousAuditValue) : null,
            newValue: serializeAuditValue(nextAuditValue), changedByUserId: userId,
            createdAt: now, updatedAt: now,
          }).run()
        }
      }

      for (const operation of reconciliation.prescriptions) {
        const values = operation.proposal.prescription
        const expectedScope: GenerationExplanation['planningScope'] =
          plan.planningCohortId === null
            ? {
                kind: 'base',
                groupTrainingPlanId: planId,
                groupId: plan.groupId,
                planningCohortId: null,
                microcycleId: values.microcycleId,
              }
            : {
                kind: 'variant',
                groupTrainingPlanId: planId,
                groupId: plan.groupId,
                planningCohortId: plan.planningCohortId,
                microcycleId: values.microcycleId,
              }
        const generationExplanation = resolveGenerationExplanationSnapshot({
          snapshots: generationExplanations,
          generationKey: operation.proposal.generationKey,
          expectedScope,
        })
        const eventKey = eventKeyByGenerationKey.get(operation.proposal.generationKey)
        const sessionId = eventKey ? eventIdByKey.get(eventKey) : undefined
        if (!sessionId) throw new Error('No se pudo resolver el evento de una prescripción.')
        const record = {
          sessionId, groupId: values.groupId, microcycleId: values.microcycleId,
          distanceKm: values.distanceKm, durationMin: values.durationMin,
          elevationGain: values.elevationGain, intensityMethod: values.intensityMethod,
          zone: values.zone, referencePercentage: values.referencePercentage, notes: values.notes,
          generationOwnership: 'generated' as const,
          generationKey: operation.proposal.generationKey,
          isDeleted: false, updatedAt: now,
        }
        if (operation.action === 'create') {
          const samePlanningScopePrescription = tx.select().from(groupSessionPrescriptions)
            .where(and(
              eq(groupSessionPrescriptions.sessionId, sessionId),
              eq(groupSessionPrescriptions.microcycleId, values.microcycleId),
            )).get()
          if (!samePlanningScopePrescription) {
            const prescriptionId = randomUUID()
            tx.insert(groupSessionPrescriptions).values({
              id: prescriptionId, ...record, createdAt: now,
            }).run()
            insertPrescriptionAudit(tx, {
              id: prescriptionId, planId, sessionId, generationKey: operation.proposal.generationKey,
              action: 'generated_created', previousValue: null, newValue: values,
              generationExplanation, now, changedByUserId: userId,
            })
          } else if (samePlanningScopePrescription.generationOwnership === 'generated') {
            tx.update(groupSessionPrescriptions).set(record)
              .where(eq(groupSessionPrescriptions.id, samePlanningScopePrescription.id)).run()
            insertPrescriptionAudit(tx, {
              id: samePlanningScopePrescription.id, planId, sessionId,
              generationKey: operation.proposal.generationKey, action: 'generated_updated',
              previousValue: samePlanningScopePrescription, newValue: values,
              generationExplanation, now, changedByUserId: userId,
            })
          }
        } else {
          const previousPrescription = persistedPrescriptions.find(
            (item) => item.id === operation.existingId,
          )
          tx.update(groupSessionPrescriptions).set(record)
            .where(eq(groupSessionPrescriptions.id, operation.existingId!)).run()
          insertPrescriptionAudit(tx, {
            id: operation.existingId!, planId, sessionId,
            generationKey: operation.proposal.generationKey, action: 'generated_updated',
            previousValue: previousPrescription ?? null, newValue: values,
            generationExplanation, now, changedByUserId: userId,
          })
        }
      }

      if (reconciliation.obsoletePrescriptionIds.length > 0) {
        tx.update(groupSessionPrescriptions).set({ isDeleted: true, updatedAt: now })
          .where(inArray(groupSessionPrescriptions.id, reconciliation.obsoletePrescriptionIds)).run()
        for (const id of reconciliation.obsoletePrescriptionIds) {
          const previous = persistedPrescriptions.find((item) => item.id === id)
          if (previous) insertPrescriptionAudit(tx, {
            id, planId, sessionId: previous.sessionId,
            generationKey: previous.generationKey ?? '', action: 'generated_removed',
            previousValue: previous, newValue: null, now, changedByUserId: userId,
          })
        }
      }
      for (const eventId of reconciliation.obsoleteEventIds) {
        const active = tx.select({ id: groupSessionPrescriptions.id })
          .from(groupSessionPrescriptions)
          .where(and(
            eq(groupSessionPrescriptions.sessionId, eventId),
            eq(groupSessionPrescriptions.isDeleted, false),
          )).get()
        if (!active) {
          tx.update(sessions).set({ isDeleted: true, updatedAt: now })
            .where(eq(sessions.id, eventId)).run()
          const previous = persistedEvents.find((event) => event.id === eventId)
          tx.insert(sessionGenerationModificationRecords).values({
            id: randomUUID(), groupTrainingPlanId: planId, sessionId: eventId,
            action: 'generated_removed', ownership: 'generated',
            generationKey: previous?.sharedEventKey ?? null,
            previousValue: previous ? serializeAuditValue(previous) : null,
            newValue: null, changedByUserId: userId, createdAt: now, updatedAt: now,
          }).run()
        }
      }
    return reconciliation.preservedRecords.length
  }

  return input.withinExistingTransaction
    ? run(db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0])
    : db.transaction(run)
}

function serializeAuditValue(value: unknown): string {
  return JSON.stringify(value)
}

function sameAuditValue(previousValue: unknown, newValue: unknown): boolean {
  return serializeAuditValue(previousValue) === serializeAuditValue(newValue)
}

function sessionAuditValue(value: {
  workoutId?: string | null
  sourceTemplateId?: string | null
  date: string
  title: string
  type: string
  locationKey: string | null
  trackPath: string | null
  structure: unknown
  notes: string | null
}) {
  return {
    sourceTemplateId: value.sourceTemplateId ?? value.workoutId ?? null,
    date: value.date, title: value.title, type: value.type,
    locationKey: value.locationKey, trackPath: value.trackPath,
    structure: value.structure, notes: value.notes,
  }
}

function insertPrescriptionAudit(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  values: {
    id: string
    planId: string
    sessionId: string
    generationKey: string
    previousValue: unknown
    newValue: unknown
    now: string
    changedByUserId: string
  } & (
    | {
        action: 'generated_created' | 'generated_updated'
        generationExplanation: GenerationExplanation | null
      }
    | {
        action: 'generated_removed'
      }
  ),
) {
  const previousValue = values.previousValue === null
    ? null
    : prescriptionAuditValue(values.previousValue)
  const newValue = values.newValue === null ? null : prescriptionAuditValue(values.newValue)
  if (values.action === 'generated_updated' && sameAuditValue(previousValue, newValue)) return

  tx.insert(sessionGenerationModificationRecords).values({
    id: randomUUID(), groupTrainingPlanId: values.planId, sessionId: values.sessionId,
    prescriptionId: values.id, action: values.action, ownership: 'generated',
    generationKey: values.generationKey || null,
    generationExplanation: values.action === 'generated_removed'
      ? null
      : values.generationExplanation,
    previousValue: previousValue === null ? null : serializeAuditValue(previousValue),
    newValue: newValue === null ? null : serializeAuditValue(newValue),
    changedByUserId: values.changedByUserId, createdAt: values.now, updatedAt: values.now,
  }).run()
}

function prescriptionAuditValue(value: unknown) {
  const record = value as Record<string, unknown>
  return {
    groupId: record.groupId,
    microcycleId: record.microcycleId,
    distanceKm: record.distanceKm,
    durationMin: record.durationMin,
    elevationGain: record.elevationGain,
    intensityMethod: record.intensityMethod,
    zone: record.zone,
    referencePercentage: record.referencePercentage,
    notes: record.notes,
  }
}


function validateProposalScope(
  proposal: SharedSessionGenerationResult,
  groupId: string,
  microcycleIds: Set<string>,
) {
  for (const event of proposal.events) {
    if (
      !event.sharedEventKey?.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(event.session?.date ?? '')
      || !event.session?.title?.trim()
      || !isWorkoutType(event.session?.type)
      || !Array.isArray(event.prescriptions)
    ) {
      throw new Error('La propuesta contiene un evento incompleto.')
    }
    for (const item of event.prescriptions ?? []) {
      if (item.prescription.groupId !== groupId || !microcycleIds.has(item.prescription.microcycleId)) {
        throw new Error('La propuesta contiene una prescripción fuera de la planificación.')
      }
    }
  }
}

