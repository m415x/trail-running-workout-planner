import type {
  AthleteDoseOverrides,
  EffectiveAudiencePrescription,
} from './athlete-session-adjustment'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from './athlete-session-adjustment-persistence'

type DoseOverrideInput = {
  distanceKm?: number | null
  durationMin?: number | null
  elevationGain?: number | null
  intensity?:
    | { method: 'hr_zone'; zone: string }
    | { method: 'reference_percentage'; referencePercentage: number }
    | null
  notes?: string | null
}

type AdjustmentPersistence = {
  applyRevision(input: {
    adjustment: PersistedAthleteSessionAdjustment
    revision: PersistedAthleteSessionAdjustmentRevision
  }): Promise<{
    adjustment: PersistedAthleteSessionAdjustment
    currentRevision: PersistedAthleteSessionAdjustmentRevision
  }>
}

export async function applyAthleteDoseAdjustment(input: {
  teamId: string
  athleteId: string
  sourcePrescription: EffectiveAudiencePrescription
  adjustmentId: string
  revisionId: string
  reason: string
  changedByUserId: string | null
  overrides: DoseOverrideInput
  persistence: AdjustmentPersistence
}) {
  const adjustment: PersistedAthleteSessionAdjustment = {
    id: input.adjustmentId,
    teamId: input.teamId,
    athleteId: input.athleteId,
    sourcePrescriptionId: input.sourcePrescription.id,
  }

  const revision: PersistedAthleteSessionAdjustmentRevision = {
    id: input.revisionId,
    adjustmentId: input.adjustmentId,
    state: 'active',
    payload: {
      dose: toDoseOverrides(input.overrides),
      assignment: { kind: 'inherit' },
    },
    reason: input.reason,
    changedByUserId: input.changedByUserId,
    isCurrent: true,
  }

  return input.persistence.applyRevision({
    adjustment,
    revision,
  })
}

function toDoseOverrides(overrides: DoseOverrideInput): AthleteDoseOverrides {
  return {
    distanceKm: toOverride(overrides, 'distanceKm'),
    durationMin: toOverride(overrides, 'durationMin'),
    elevationGain: toOverride(overrides, 'elevationGain'),
    intensity: toOverride(overrides, 'intensity'),
    notes: toOverride(overrides, 'notes'),
  }
}

function toOverride<
  T extends keyof DoseOverrideInput,
>(
  overrides: DoseOverrideInput,
  key: T,
): AthleteDoseOverrides[T] {
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    return {
      kind: 'override',
      value: overrides[key],
    } as AthleteDoseOverrides[T]
  }

  return { kind: 'inherit' } as AthleteDoseOverrides[T]
}
