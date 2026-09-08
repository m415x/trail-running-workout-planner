'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import {
  groupSessionPrescriptions,
  groupTrainingPlans,
  athleteGroups,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
  sessionGenerationModificationRecords,
} from '@/db/schema'
import { reconcileSessionGeneration } from '@/lib/session-generation/session-regeneration'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

const CURRENT_TEAM_ID = 'team_1'
const WORKOUT_TYPES = new Set([
  'Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Rest', 'Race',
])

export interface PersistGeneratedSessionsState {
  error?: string
  success?: string
}

/** Persists the reviewed proposal idempotently without overwriting protected records. */
export async function persistGeneratedSessions(
  _previousState: PersistGeneratedSessionsState,
  formData: FormData,
): Promise<PersistGeneratedSessionsState> {
  const planId = formData.get('planId')?.toString()
  const locale = formData.get('locale')?.toString() || 'es'
  const rawProposal = formData.get('proposal')?.toString()
  if (!planId || !rawProposal) return { error: 'No se pudo identificar la propuesta.' }

  try {
    const proposal = parseProposal(rawProposal)
    const plan = db.select({ id: groupTrainingPlans.id, groupId: groupTrainingPlans.groupId })
      .from(groupTrainingPlans)
      .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
      .where(and(
        eq(groupTrainingPlans.id, planId),
        eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(groupTrainingPlans.isDeleted, false),
      ))
      .get()
    if (!plan) return { error: 'La planificación no existe.' }

    const planMicrocycles = db.select({ id: microcycles.id })
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

    const persistedPrescriptions = planMicrocycles.length === 0 ? [] : db.select()
      .from(groupSessionPrescriptions)
      .where(and(
        inArray(groupSessionPrescriptions.microcycleId, [...microcycleIds]),
        eq(groupSessionPrescriptions.isDeleted, false),
      ))
      .all()
    const proposedEventKeys = proposal.events.map(({ sharedEventKey }) => sharedEventKey)
    const relatedSessionIds = [...new Set(persistedPrescriptions.map(({ sessionId }) => sessionId))]
    const persistedEventsById = relatedSessionIds.length === 0 ? [] : db.select()
      .from(sessions)
      .where(inArray(sessions.id, relatedSessionIds))
      .all()
    const persistedEventsByKey = proposedEventKeys.length === 0 ? [] : db.select()
      .from(sessions)
      .where(inArray(sessions.sharedEventKey, proposedEventKeys))
      .all()
    const persistedEvents = [...new Map(
      [...persistedEventsById, ...persistedEventsByKey].map((event) => [event.id, event]),
    ).values()]

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
    const now = new Date().toISOString()

    db.transaction((tx) => {
      for (const operation of reconciliation.events) {
        const values = operation.proposal.session
        const id = operation.existingId ?? randomUUID()
        const previousEvent = operation.existingId
          ? persistedEvents.find((event) => event.id === operation.existingId) ?? null
          : null
        eventIdByKey.set(operation.proposal.sharedEventKey, id)
        if (operation.action === 'create') {
          tx.insert(sessions).values({
            id, teamId: CURRENT_TEAM_ID, workoutId: values.sourceTemplateId,
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
            newValue: serializeAuditValue(nextAuditValue), changedByUserId: null,
            createdAt: now, updatedAt: now,
          }).run()
        }
      }

      for (const operation of reconciliation.prescriptions) {
        const values = operation.proposal.prescription
        const eventKey = eventKeyByGenerationKey.get(operation.proposal.generationKey)
        const sessionId = eventKey ? eventIdByKey.get(eventKey) : undefined
        if (!sessionId) throw new Error('No se pudo resolver el evento de una prescripción.')
        const record = {
          sessionId, groupId: values.groupId, microcycleId: values.microcycleId,
          distanceKm: values.distanceKm, durationMin: values.durationMin,
          elevationGain: values.elevationGain, intensityMethod: values.intensityMethod,
          zone: values.zone, pamPercentage: values.pamPercentage, notes: values.notes,
          generationOwnership: 'generated' as const,
          generationKey: operation.proposal.generationKey,
          isDeleted: false, updatedAt: now,
        }
        if (operation.action === 'create') {
          const sameGroupPrescription = tx.select().from(groupSessionPrescriptions)
            .where(and(
              eq(groupSessionPrescriptions.sessionId, sessionId),
              eq(groupSessionPrescriptions.groupId, values.groupId),
            )).get()
          if (!sameGroupPrescription) {
            const prescriptionId = randomUUID()
            tx.insert(groupSessionPrescriptions).values({
              id: prescriptionId, ...record, createdAt: now,
            }).run()
            insertPrescriptionAudit(tx, {
              id: prescriptionId, planId, sessionId, generationKey: operation.proposal.generationKey,
              action: 'generated_created', previousValue: null, newValue: values, now,
            })
          } else if (sameGroupPrescription.generationOwnership === 'generated') {
            tx.update(groupSessionPrescriptions).set(record)
              .where(eq(groupSessionPrescriptions.id, sameGroupPrescription.id)).run()
            insertPrescriptionAudit(tx, {
              id: sameGroupPrescription.id, planId, sessionId,
              generationKey: operation.proposal.generationKey, action: 'generated_updated',
              previousValue: sameGroupPrescription, newValue: values, now,
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
            previousValue: previousPrescription ?? null, newValue: values, now,
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
            previousValue: previous, newValue: null, now,
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
            newValue: null, changedByUserId: null, createdAt: now, updatedAt: now,
          }).run()
        }
      }
    })

    const basePath = locale === 'es' ? '/dashboard' : `/${locale}/dashboard`
    revalidatePath(`${basePath}/planning/${planId}`)
    revalidatePath(`${basePath}/sessions`)
    revalidatePath(locale === 'es' ? '/plan' : `/${locale}/plan`)

    const protectedCount = reconciliation.preservedRecords.length
    return {
      success: protectedCount > 0
        ? `Propuesta guardada. Se preservaron ${protectedCount} modificaciones manuales.`
        : 'Propuesta de sesiones guardada correctamente.',
    }
  } catch (error) {
    console.error('Error persisting generated sessions:', error)
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la propuesta.' }
  }
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
    action: 'generated_created' | 'generated_updated' | 'generated_removed'
    previousValue: unknown
    newValue: unknown
    now: string
  },
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
    previousValue: previousValue === null ? null : serializeAuditValue(previousValue),
    newValue: newValue === null ? null : serializeAuditValue(newValue),
    changedByUserId: null, createdAt: values.now, updatedAt: values.now,
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
    pamPercentage: record.pamPercentage,
    notes: record.notes,
  }
}

function parseProposal(value: string): SharedSessionGenerationResult {
  if (value.length > 1_000_000) throw new Error('La propuesta de sesiones es demasiado grande.')
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || !('events' in parsed) || !Array.isArray(parsed.events)) {
    throw new Error('La propuesta de sesiones no es válida.')
  }
  return parsed as SharedSessionGenerationResult
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
      || !WORKOUT_TYPES.has(event.session?.type)
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
