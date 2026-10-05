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
  workouts,
} from '@/db/schema'
import { projectAthleteAdministrativeRead } from '@/lib/athletes/administrative-read-model'
import { createDrizzleAthleteSessionAdjustmentDatabase } from '@/lib/planning-cohorts/athlete-session-adjustment-drizzle-database'
import {
  createAthleteSessionAdjustmentPersistenceAdapter,
  type PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'
import { resolveEffectiveAthleteAdjustment } from '@/lib/planning-cohorts/athlete-adjustment-resolution'
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
  revisionId: string | null
  currentReason: string | null
  authorityStatus: 'effective' | 'outside_authority'
  reviewRequired: boolean
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
  if (athletes.length === 0) return []

  const sessionPrescriptionHistory = await db.select()
    .from(groupSessionPrescriptions)
    .where(eq(groupSessionPrescriptions.sessionId, sessionId))

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

  const historicalPrescriptionIds = sessionPrescriptionHistory.map(prescription => prescription.id)
  const sessionAdjustments = historicalPrescriptionIds.length === 0
    ? []
    : await db.select()
        .from(athleteSessionAdjustments)
        .where(and(
          inArray(athleteSessionAdjustments.sourcePrescriptionId, historicalPrescriptionIds),
          eq(athleteSessionAdjustments.isDeleted, false),
        ))
  const sessionAdjustmentIds = sessionAdjustments.map(adjustment => adjustment.id)
  const sessionCurrentRevisions = sessionAdjustmentIds.length === 0
    ? []
    : await db.select()
        .from(athleteSessionAdjustmentRevisions)
        .where(and(
          inArray(athleteSessionAdjustmentRevisions.adjustmentId, sessionAdjustmentIds),
          eq(athleteSessionAdjustmentRevisions.isCurrent, true),
          eq(athleteSessionAdjustmentRevisions.isDeleted, false),
        ))

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

    const effectiveSourcePrescription = prescriptionResolution.status === 'resolved'
      ? session.sessionPrescriptions.find(item => item.id === prescriptionResolution.prescriptionId) ?? null
      : null

    const athleteAdjustments = sessionAdjustments.filter(
      adjustment => adjustment.athleteId === athlete.id,
    )
    const effectiveAdjustment = effectiveSourcePrescription
      ? athleteAdjustments.find(
          adjustment => adjustment.sourcePrescriptionId === effectiveSourcePrescription.id,
        ) ?? null
      : null
    const staleAdjustment = athleteAdjustments.find(
      adjustment => adjustment.sourcePrescriptionId !== effectiveSourcePrescription?.id,
    ) ?? null
    const reviewAdjustment = effectiveAdjustment ?? staleAdjustment

    if (!effectiveSourcePrescription && !reviewAdjustment) continue

    const reviewSourcePrescription = reviewAdjustment
      ? sessionPrescriptionHistory.find(
          prescription => prescription.id === reviewAdjustment.sourcePrescriptionId,
        ) ?? null
      : null
    const displayPrescription = effectiveSourcePrescription ?? reviewSourcePrescription
    if (!displayPrescription) continue

    const reviewRevisions = reviewAdjustment
      ? sessionCurrentRevisions
          .filter(revision => revision.adjustmentId === reviewAdjustment.id)
          .map(revision => ({
            id: revision.id,
            adjustmentId: revision.adjustmentId,
            state: revision.state,
            payload: revision.payload as PersistedAthleteSessionAdjustmentRevision['payload'],
            reason: revision.reason,
            changedByUserId: revision.changedByUserId,
            isCurrent: revision.isCurrent,
          }))
      : []
    const currentReviewRevision = reviewRevisions.find(revision => revision.isCurrent) ?? null

    const authorityResolution = effectiveSourcePrescription
      ? resolveEffectiveAthleteAdjustment({
          athleteId: athlete.id,
          effectivePrescriptionId: effectiveSourcePrescription.id,
          adjustment: reviewAdjustment
            ? {
                id: reviewAdjustment.id,
                teamId: reviewAdjustment.teamId,
                athleteId: reviewAdjustment.athleteId,
                sourcePrescriptionId: reviewAdjustment.sourcePrescriptionId,
              }
            : null,
          revisions: reviewRevisions,
        })
      : reviewAdjustment
        ? {
            status: 'outside_authority' as const,
            reason: 'source-prescription-mismatch' as const,
            adjustmentId: reviewAdjustment.id,
          }
        : {
            status: 'none' as const,
            reason: 'no-current-revision' as const,
          }

    const outsideAuthority = authorityResolution.status === 'outside_authority'
      && authorityResolution.reason === 'source-prescription-mismatch'
    const currentPayload = authorityResolution.status === 'resolved'
      ? authorityResolution.revision.payload
      : outsideAuthority && currentReviewRevision?.state === 'active'
        ? currentReviewRevision.payload
        : null
    const dose = currentPayload?.dose ?? null
    const assignment = currentPayload?.assignment ?? null

    const administrative = projectAthleteAdministrativeRead(athlete)
    const athleteName = administrative.name
      ? `${administrative.name.lastName} ${administrative.name.firstName}`
      : athlete.id

    rows.push({
      athleteId: athlete.id,
      athleteName,
      sourcePrescriptionId: reviewAdjustment?.sourcePrescriptionId ?? effectiveSourcePrescription!.id,
      distanceKm: dose?.distanceKm?.kind === 'override' ? dose.distanceKm.value : null,
      durationMin: dose?.durationMin?.kind === 'override' ? dose.durationMin.value : null,
      elevationGain: dose?.elevationGain?.kind === 'override' ? dose.elevationGain.value : null,
      inheritedDistanceKm: displayPrescription.distanceKm,
      inheritedDurationMin: displayPrescription.durationMin,
      inheritedElevationGain: displayPrescription.elevationGain,
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
      inheritedIntensity: formatReviewIntensity(displayPrescription, null),
      rescheduled: assignment?.kind === 'rescheduled' ? assignment.date : null,
      stimulus: assignment?.kind === 'stimulus_override' ? assignment.workoutId : null,
      stimulusType: assignment?.kind === 'stimulus_override' ? assignment.type : null,
      omitted: assignment?.kind === 'omitted',
      revisionId: authorityResolution.status === 'resolved'
        ? authorityResolution.revision.id
        : currentReviewRevision?.id ?? null,
      currentReason: authorityResolution.status === 'resolved'
        ? authorityResolution.revision.reason
        : currentReviewRevision?.reason ?? null,
      authorityStatus: outsideAuthority ? 'outside_authority' : 'effective',
      reviewRequired: outsideAuthority,
    })
  }

  return rows.sort((first, second) => first.athleteName.localeCompare(second.athleteName, 'es'))
}

export async function saveAthleteSessionAdjustment(_previousState: { error?: string }, formData: FormData) {
  const sessionId = String(formData.get('sessionId') ?? '')
  const athleteId = String(formData.get('athleteId') ?? '')
  const sourcePrescriptionId = String(formData.get('sourcePrescriptionId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!sessionId || !athleteId || !sourcePrescriptionId) {
    return { error: 'invalidForm' }
  }
  if (!reason.trim()) return { error: 'reasonRequired' }

  const sourcePrescription = await db.query.groupSessionPrescriptions.findFirst({
    where: and(
      eq(groupSessionPrescriptions.id, sourcePrescriptionId),
      eq(groupSessionPrescriptions.sessionId, sessionId),
      eq(groupSessionPrescriptions.isDeleted, false),
    ),
  })
  if (!sourcePrescription) return { error: 'sourcePrescriptionNotFound' }

  const effectiveSourcePrescriptionId = await resolveEffectiveSourcePrescriptionId({
    sessionId,
    athleteId,
  })
  if (effectiveSourcePrescriptionId !== sourcePrescriptionId) {
    return { error: 'staleSourcePrescription' }
  }

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
    const stimulusWorkoutId = String(formData.get('stimulus') ?? '').trim()
    const stimulusWorkout = stimulusWorkoutId
      ? (await db.query.workouts.findFirst({
          where: and(
            eq(workouts.id, stimulusWorkoutId),
            eq(workouts.teamId, CURRENT_TEAM_ID),
            eq(workouts.isDeleted, false),
          ),
        })) ?? null
      : null
    if (stimulusWorkoutId && !stimulusWorkout) {
      return { error: 'stimulusWorkoutNotFound' }
    }

    const assignment = parseAssignmentOverride(formData, stimulusWorkout)
    if (!assignment.success) return { error: assignment.error }

    const allInherit = dose === null && assignment.value.kind === 'inherit'
    if (allInherit && !existingAdjustment) {
      revalidatePath(`/dashboard/sessions/${sessionId}`)
      return {}
    }

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
        state: allInherit ? 'withdrawn' : 'active',
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

async function resolveEffectiveSourcePrescriptionId(input: {
  sessionId: string
  athleteId: string
}) {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, input.sessionId),
      eq(sessions.teamId, CURRENT_TEAM_ID),
      eq(sessions.isDeleted, false),
    ),
    with: {
      sessionPrescriptions: {
        where: eq(groupSessionPrescriptions.isDeleted, false),
      },
    },
  })
  if (!session) return null

  const athlete = await db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.id, input.athleteId),
      eq(athleteProfiles.teamId, CURRENT_TEAM_ID),
      eq(athleteProfiles.isDeleted, false),
    ),
  })
  if (!athlete?.groupId) return null

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

  const microcycleIds = [...new Set(
    session.sessionPrescriptions.map(prescription => prescription.microcycleId),
  )]
  const lineages = microcycleIds.length === 0
    ? []
    : await db.select({
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

  return prescriptionResolution.status === 'resolved'
    ? prescriptionResolution.prescriptionId
    : null
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

function parseAssignmentOverride(
  formData: FormData,
  stimulusWorkout: { id: string; type: string } | null,
):
  | { success: true; value: AthleteAssignmentOverride }
  | { success: false; error: string } {
  const assignmentMode = String(formData.get('assignmentMode') ?? 'inherit').trim()
  const rescheduled = String(formData.get('rescheduled') ?? '').trim()
  const stimulusType = String(formData.get('stimulusType') ?? '').trim()

  if (assignmentMode === 'inherit') {
    return { success: true, value: { kind: 'inherit' } }
  }

  if (assignmentMode === 'omitted') {
    return { success: true, value: { kind: 'omitted' } }
  }

  if (assignmentMode === 'rescheduled') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rescheduled)) {
      return { success: false, error: 'invalidReschedule' }
    }
    return { success: true, value: { kind: 'rescheduled', date: rescheduled } }
  }

  if (assignmentMode === 'stimulus_override') {
    if (stimulusWorkout) {
      if (!isWorkoutType(stimulusWorkout.type)) {
        return { success: false, error: 'invalidStimulusType' }
      }
      return {
        success: true,
        value: {
          kind: 'stimulus_override',
          workoutId: stimulusWorkout.id,
          type: stimulusWorkout.type,
        },
      }
    }

    if (!isWorkoutType(stimulusType)) {
      return { success: false, error: 'invalidStimulusType' }
    }

    return {
      success: true,
      value: {
        kind: 'stimulus_override',
        workoutId: null,
        type: stimulusType,
      },
    }
  }

  return { success: false, error: 'invalidAssignmentMode' }
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
