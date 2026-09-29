'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import {
  athleteProfiles,
  athleteSessionAdjustmentRevisions,
  athleteSessionAdjustments,
  groupHistoryRecords,
  groupSessionPrescriptions,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
  planningCohortMemberships,
  sessions,
} from '@/db/schema'
import { createDrizzleAthleteSessionAdjustmentDatabase } from '@/lib/planning-cohorts/athlete-session-adjustment-drizzle-database'
import {
  createAthleteSessionAdjustmentPersistenceAdapter,
  type PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'
import { resolveAthleteSessionPrescription } from '@/lib/planning-cohorts/athlete-session-prescription'
import { resolveAthletePlanningOnDate } from '@/lib/planning-cohorts/planning-resolution'
import type {
  AthleteAssignmentOverride,
  AthleteDoseOverrides,
  EffectiveAudiencePrescription,
} from '@/lib/planning-cohorts/athlete-session-adjustment'
import type { IntensityZone } from '@/types/training/intensity.types'
import { isWorkoutType } from '@/types/training/workout.types'

const CURRENT_TEAM_ID = 'team_1'

export interface SessionAthleteAdjustmentReviewItem {
  athleteId: string
  athleteName: string
  sourcePrescriptionId: string
  distanceKm: number | null
  durationMin: number | null
  elevationGain: number | null
  inheritedDistanceKm: number | null
  inheritedDurationMin: number | null
  inheritedElevationGain: number | null
  intensityMethod: 'hr_zone' | 'reference_percentage' | 'clear' | null
  zone: IntensityZone | null
  referencePercentage: number | null
  inheritedIntensity: string | null
  rescheduled: string | null
  stimulus: string | null
  stimulusType: string | null
  omitted: boolean
}

export async function getSessionAthleteAdjustmentReview(
  sessionId: string,
): Promise<SessionAthleteAdjustmentReviewItem[]> {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, sessionId),
      eq(sessions.teamId, CURRENT_TEAM_ID),
      eq(sessions.isDeleted, false),
    ),
    with: {
      sessionPrescriptions: {
        where: eq(groupSessionPrescriptions.isDeleted, false),
      },
    },
  })
  if (!session) return []

  const athletes = await db.query.athleteProfiles.findMany({
    where: and(
      eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
      eq(athleteProfiles.isDeleted, false),
      eq(athleteProfiles.isActive, true),
    ),
    with: {
      user: true,
    },
  })
  if (athletes.length === 0 || session.sessionPrescriptions.length === 0) return []

  const microcycleIds = [...new Set(session.sessionPrescriptions.map(item => item.microcycleId))]
  const lineages = await db.select({
    microcycleId: microcycles.id,
    groupTrainingPlanId: groupTrainingPlans.id,
  })
    .from(microcycles)
    .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
    .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
    .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
    .where(inArray(microcycles.id, microcycleIds))
  const planIdByMicrocycle = new Map(
    lineages.map(({ microcycleId, groupTrainingPlanId }) => [microcycleId, groupTrainingPlanId]),
  )

  const rows: SessionAthleteAdjustmentReviewItem[] = []

  for (const athlete of athletes) {
    if (!athlete.groupId) continue

    const groupChanges = await db.select().from(groupHistoryRecords)
      .where(and(
        eq(groupHistoryRecords.athleteId, athlete.id),
        eq(groupHistoryRecords.isDeleted, false),
      ))

    const memberships = await db.query.planningCohortMemberships.findMany({
      where: and(
        eq(planningCohortMemberships.athleteProfileId, athlete.id),
        eq(planningCohortMemberships.isDeleted, false),
      ),
      with: {
        planningCohort: {
          with: {
            planningVariant: {
              with: { macrocycles: true },
            },
          },
        },
      },
    })

    const relevantGroupIds = [...new Set([
      athlete.groupId,
      ...groupChanges.flatMap(change => [change.previousGroupId, change.newGroupId]),
    ].filter((groupId): groupId is string => groupId !== null))]

    const basePlans = relevantGroupIds.length === 0
      ? []
      : await db.query.groupTrainingPlans.findMany({
          where: and(
            inArray(groupTrainingPlans.groupId, relevantGroupIds),
            eq(groupTrainingPlans.isDeleted, false),
          ),
          with: { macrocycles: true },
        })

    const planning = resolveAthletePlanningOnDate({
      athleteTeamId: athlete.teamId,
      currentGroupId: athlete.groupId,
      groupChanges,
      memberships: memberships.map(membership => ({
        id: membership.id,
        startDate: membership.startDate,
        endDate: membership.endDate,
        isDeleted: membership.isDeleted,
        cohort: {
          id: membership.planningCohort.id,
          teamId: membership.planningCohort.teamId,
          groupId: membership.planningCohort.groupId,
          status: membership.planningCohort.status,
          isDeleted: membership.planningCohort.isDeleted,
          planningVariant: membership.planningCohort.planningVariant
            ? {
                id: membership.planningCohort.planningVariant.id,
                groupId: membership.planningCohort.planningVariant.groupId,
                planningCohortId: membership.planningCohort.planningVariant.planningCohortId,
                status: membership.planningCohort.planningVariant.status,
                isDeleted: membership.planningCohort.planningVariant.isDeleted,
                macrocycles: membership.planningCohort.planningVariant.macrocycles,
              }
            : null,
        },
      })),
      basePlans: basePlans.map(plan => ({
        id: plan.id,
        groupId: plan.groupId,
        planningCohortId: plan.planningCohortId,
        status: plan.status,
        isDeleted: plan.isDeleted,
        macrocycles: plan.macrocycles,
      })),
      date: session.date,
    })

    const prescriptionResolution = resolveAthleteSessionPrescription({
      planning,
      prescriptions: session.sessionPrescriptions.flatMap(prescription => {
        const groupTrainingPlanId = planIdByMicrocycle.get(prescription.microcycleId)
        return groupTrainingPlanId
          ? [{
              id: prescription.id,
              groupId: prescription.groupId,
              microcycleId: prescription.microcycleId,
              groupTrainingPlanId,
            }]
          : []
      }),
    })
    if (prescriptionResolution.status !== 'resolved') continue

    const sourcePrescription = session.sessionPrescriptions.find(
      item => item.id === prescriptionResolution.prescriptionId,
    )
    if (!sourcePrescription) continue

    const adjustment = await db.query.athleteSessionAdjustments.findFirst({
      where: and(
        eq(athleteSessionAdjustments.athleteId, athlete.id),
        eq(athleteSessionAdjustments.sourcePrescriptionId, sourcePrescription.id),
        eq(athleteSessionAdjustments.isDeleted, false),
      ),
    })
    const currentRevision = adjustment
      ? await db.query.athleteSessionAdjustmentRevisions.findFirst({
          where: and(
            eq(athleteSessionAdjustmentRevisions.adjustmentId, adjustment.id),
            eq(athleteSessionAdjustmentRevisions.isCurrent, true),
            eq(athleteSessionAdjustmentRevisions.isDeleted, false),
          ),
        })
      : null

    const currentPayload = currentRevision?.state === 'active'
      ? currentRevision.payload as PersistedAthleteSessionAdjustmentRevision['payload']
      : null
    const dose = currentPayload?.dose ?? null
    const assignment = currentPayload?.assignment ?? null

    rows.push({
      athleteId: athlete.id,
      athleteName: `${athlete.user.lastName} ${athlete.user.firstName}`,
      sourcePrescriptionId: sourcePrescription.id,
      distanceKm: dose?.distanceKm?.kind === 'override' ? dose.distanceKm.value : null,
      durationMin: dose?.durationMin?.kind === 'override' ? dose.durationMin.value : null,
      elevationGain: dose?.elevationGain?.kind === 'override' ? dose.elevationGain.value : null,
      inheritedDistanceKm: sourcePrescription.distanceKm,
      inheritedDurationMin: sourcePrescription.durationMin,
      inheritedElevationGain: sourcePrescription.elevationGain,
      intensityMethod: dose?.intensity?.kind === 'override'
        ? dose.intensity.value === null
          ? 'clear'
          : dose.intensity.value.method
        : null,
      zone: dose?.intensity?.kind === 'override' && dose.intensity.value?.method === 'hr_zone'
        ? dose.intensity.value.zone
        : null,
      referencePercentage: dose?.intensity?.kind === 'override'
        && dose.intensity.value?.method === 'reference_percentage'
        ? dose.intensity.value.referencePercentage
        : null,
      inheritedIntensity: formatReviewIntensity(sourcePrescription, null),
      rescheduled: assignment?.kind === 'rescheduled' ? assignment.date : null,
      stimulus: assignment?.kind === 'stimulus_override' ? assignment.workoutId : null,
      stimulusType: assignment?.kind === 'stimulus_override' ? assignment.type : null,
      omitted: assignment?.kind === 'omitted',
    })
  }

  return rows.sort((first, second) => first.athleteName.localeCompare(second.athleteName, 'es'))
}

export async function saveAthleteSessionAdjustment(_previousState: { error?: string }, formData: FormData) {
  const sessionId = String(formData.get('sessionId') ?? '')
  const athleteId = String(formData.get('athleteId') ?? '')
  const sourcePrescriptionId = String(formData.get('sourcePrescriptionId') ?? '')
  const reason = String(formData.get('reason') ?? 'Coach individual review')

  if (!sessionId || !athleteId || !sourcePrescriptionId) {
    return { error: 'invalidForm' }
  }

  const sourcePrescription = await db.query.groupSessionPrescriptions.findFirst({
    where: and(
      eq(groupSessionPrescriptions.id, sourcePrescriptionId),
      eq(groupSessionPrescriptions.sessionId, sessionId),
      eq(groupSessionPrescriptions.isDeleted, false),
    ),
  })
  if (!sourcePrescription) return { error: 'sourcePrescriptionNotFound' }

  const adjustmentDatabase = createDrizzleAthleteSessionAdjustmentDatabase(
    db as unknown as Parameters<typeof createDrizzleAthleteSessionAdjustmentDatabase>[0],
  )
  const existingAdjustment = await adjustmentDatabase.getAdjustmentByIdentity(
    athleteId,
    sourcePrescriptionId,
  )
  const persistence = createAthleteSessionAdjustmentPersistenceAdapter(adjustmentDatabase)
  const adjustmentId = existingAdjustment ? existingAdjustment.id : randomUUID()
  const revisionId = randomUUID()

  try {
    const dose = parseDoseOverrides(formData)
    const assignment = parseAssignmentOverride(formData)
    if (!assignment.success) return { error: assignment.error }

    await persistence.applyRevision({
      adjustment: {
        id: adjustmentId,
        teamId: CURRENT_TEAM_ID,
        athleteId,
        sourcePrescriptionId,
      },
      revision: {
        id: revisionId,
        adjustmentId,
        state: 'active',
        payload: {
          dose,
          assignment: assignment.value,
        },
        reason,
        changedByUserId: null,
        isCurrent: true,
      },
    })
  } catch (error) {
    console.error('Error saving athlete session adjustment:', error)
    return { error: 'saveFailed' }
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return {}
}

function parseDoseOverrides(formData: FormData): AthleteDoseOverrides | null {
  const distanceKm = parseOptionalNumber(formData.get('distanceKm'))
  const durationMin = parseOptionalNumber(formData.get('durationMin'))
  const elevationGain = parseOptionalNumber(formData.get('elevationGain'))
  const intensityMethod = String(formData.get('intensityMethod') ?? '').trim()

  const dose: AthleteDoseOverrides = {
    distanceKm: distanceKm === undefined
      ? { kind: 'inherit' }
      : { kind: 'override', value: distanceKm },
    durationMin: durationMin === undefined
      ? { kind: 'inherit' }
      : { kind: 'override', value: durationMin },
    elevationGain: elevationGain === undefined
      ? { kind: 'inherit' }
      : { kind: 'override', value: elevationGain },
    intensity: { kind: 'inherit' },
  }

  if (intensityMethod === 'clear') {
    dose.intensity = { kind: 'override', value: null }
  } else if (intensityMethod === 'hr_zone') {
    const zone = String(formData.get('zone') ?? '')
    if (!isIntensityZone(zone)) throw new Error('Invalid HR zone')
    dose.intensity = { kind: 'override', value: { method: 'hr_zone', zone } }
  } else if (intensityMethod === 'reference_percentage') {
    const referencePercentage = parseOptionalNumber(formData.get('referencePercentage'))
    if (referencePercentage === undefined || referencePercentage <= 0) {
      throw new Error('Invalid reference percentage')
    }
    dose.intensity = {
      kind: 'override',
      value: { method: 'reference_percentage', referencePercentage },
    }
  } else if (intensityMethod !== '') {
    throw new Error('Invalid intensity method')
  }

  const hasOverride = Object.values(dose).some(value => value.kind === 'override')
  return hasOverride ? dose : null
}

function parseAssignmentOverride(formData: FormData):
  | { success: true; value: AthleteAssignmentOverride }
  | { success: false; error: string } {
  if (formData.get('omitted') === 'on') {
    return { success: true, value: { kind: 'omitted' } }
  }

  const rescheduled = String(formData.get('rescheduled') ?? '').trim()
  const stimulus = String(formData.get('stimulus') ?? '').trim()
  const stimulusType = String(formData.get('stimulusType') ?? '').trim()

  if (rescheduled) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rescheduled)) {
      return { success: false, error: 'invalidReschedule' }
    }
    return { success: true, value: { kind: 'rescheduled', date: rescheduled } }
  }

  if (stimulus || stimulusType) {
    if (!isWorkoutType(stimulusType)) {
      return { success: false, error: 'invalidStimulusType' }
    }
    return {
      success: true,
      value: {
        kind: 'stimulus_override',
        workoutId: stimulus || null,
        type: stimulusType,
      },
    }
  }

  return { success: true, value: { kind: 'inherit' } }
}

function isIntensityZone(value: string): value is IntensityZone {
  return ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].includes(value)
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (!text) return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatReviewIntensity(
  sourcePrescription: EffectiveAudiencePrescription,
  dose: {
    intensity: {
      kind: 'inherit'
    } | {
      kind: 'override'
      value:
        | { method: 'hr_zone'; zone: string }
        | { method: 'reference_percentage'; referencePercentage: number }
        | null
    }
  } | null | undefined,
) {
  if (dose?.intensity.kind === 'override') {
    const value = dose.intensity.value
    if (value === null) return null
    if (value.method === 'hr_zone') return value.zone
    return `${value.referencePercentage}%`
  }
  if (sourcePrescription.intensityMethod === 'hr_zone') return sourcePrescription.zone
  if (
    sourcePrescription.intensityMethod === 'reference_percentage'
    && sourcePrescription.referencePercentage !== null
  ) {
    return `${sourcePrescription.referencePercentage}%`
  }
  return null
}
