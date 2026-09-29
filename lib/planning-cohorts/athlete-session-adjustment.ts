import type { IntensityZone } from '@/types/training/intensity.types'
import type { WorkoutType } from '@/types/training/workout.types'

export interface SharedSessionEvent {
  id: string
  date: string
  workoutId: string | null
  type: WorkoutType
}

export interface EffectiveAudiencePrescription {
  id: string
  distanceKm: number | null
  durationMin: number | null
  elevationGain: number | null
  intensityMethod: 'hr_zone' | 'reference_percentage' | null
  zone: IntensityZone | null
  referencePercentage: number | null
  notes: string | null
}

export type InheritableOverride<T> =
  | { kind: 'inherit' }
  | { kind: 'override'; value: T }

export type AthleteDoseOverrides = {
  distanceKm: InheritableOverride<number | null>
  durationMin: InheritableOverride<number | null>
  elevationGain: InheritableOverride<number | null>
  intensity: InheritableOverride<
    | { method: 'hr_zone'; zone: IntensityZone }
    | { method: 'reference_percentage'; referencePercentage: number }
    | null
  >
  notes: InheritableOverride<string | null>
}

export type AthleteAssignmentOverride =
  | { kind: 'inherit' }
  | { kind: 'rescheduled'; date: string }
  | { kind: 'stimulus_override'; workoutId: string | null; type: WorkoutType }
  | { kind: 'omitted' }

export interface AthleteSessionAdjustment {
  id: string
  athleteId: string
  sourcePrescriptionId: string
  dose: AthleteDoseOverrides | null
  assignment: AthleteAssignmentOverride
}

export type AthletePlannedSessionResolution =
  | {
      status: 'resolved'
      session: SharedSessionEvent
      prescription: EffectiveAudiencePrescription
      adjustmentId: string | null
    }
  | {
      status: 'omitted'
      adjustmentId: string
      sourcePrescriptionId: string
    }
  | {
      status: 'outside_authority'
      reason: 'athlete-mismatch' | 'source-prescription-mismatch'
      adjustmentId: string
    }

export function resolveAthletePlannedSession(input: {
  athleteId: string
  session: SharedSessionEvent
  prescription: EffectiveAudiencePrescription
  adjustment: AthleteSessionAdjustment | null
}): AthletePlannedSessionResolution {
  const { athleteId, session, prescription, adjustment } = input

  if (!adjustment) {
    return {
      status: 'resolved',
      session,
      prescription,
      adjustmentId: null,
    }
  }

  if (adjustment.athleteId !== athleteId) {
    return {
      status: 'outside_authority',
      reason: 'athlete-mismatch',
      adjustmentId: adjustment.id,
    }
  }

  if (adjustment.sourcePrescriptionId !== prescription.id) {
    return {
      status: 'outside_authority',
      reason: 'source-prescription-mismatch',
      adjustmentId: adjustment.id,
    }
  }

  if (adjustment.assignment.kind === 'omitted') {
    return {
      status: 'omitted',
      adjustmentId: adjustment.id,
      sourcePrescriptionId: prescription.id,
    }
  }

  const resolvedSession = applyAssignmentOverride(session, adjustment.assignment)
  const resolvedPrescription = applyDoseOverrides(prescription, adjustment.dose)

  return {
    status: 'resolved',
    session: resolvedSession,
    prescription: resolvedPrescription,
    adjustmentId: adjustment.id,
  }
}

function applyAssignmentOverride(
  session: SharedSessionEvent,
  assignment: AthleteAssignmentOverride,
): SharedSessionEvent {
  switch (assignment.kind) {
    case 'inherit':
      return session
    case 'rescheduled':
      return {
        ...session,
        date: assignment.date,
      }
    case 'stimulus_override':
      return {
        ...session,
        workoutId: assignment.workoutId,
        type: assignment.type,
      }
    case 'omitted':
      return session
  }
}

function applyDoseOverrides(
  prescription: EffectiveAudiencePrescription,
  dose: AthleteDoseOverrides | null,
): EffectiveAudiencePrescription {
  if (!dose) return prescription

  let intensityMethod = prescription.intensityMethod
  let zone = prescription.zone
  let referencePercentage = prescription.referencePercentage

  if (dose.intensity.kind === 'override') {
    const value = dose.intensity.value
    if (value === null) {
      intensityMethod = null
      zone = null
      referencePercentage = null
    } else if (value.method === 'hr_zone') {
      intensityMethod = 'hr_zone'
      zone = value.zone
      referencePercentage = null
    } else {
      intensityMethod = 'reference_percentage'
      zone = null
      referencePercentage = value.referencePercentage
    }
  }

  return {
    ...prescription,
    distanceKm: resolveOverride(prescription.distanceKm, dose.distanceKm),
    durationMin: resolveOverride(prescription.durationMin, dose.durationMin),
    elevationGain: resolveOverride(prescription.elevationGain, dose.elevationGain),
    intensityMethod,
    zone,
    referencePercentage,
    notes: resolveOverride(prescription.notes, dose.notes),
  }
}

function resolveOverride<T>(inherited: T, override: InheritableOverride<T>): T {
  return override.kind === 'override' ? override.value : inherited
}
