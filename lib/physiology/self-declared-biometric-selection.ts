/**
 * Pure, in-memory selection contract for athlete-declared biometrics.
 * This is NOT a persistence adapter, an authorization boundary or a
 * production disclosure route. Callers must independently authorize sources.
 */
export type SelfDeclaredBiometricKind = 'weight' | 'height' | 'max_hr' | 'rest_hr'

export interface SelfDeclaredBiometricObservation {
  readonly id: string
  readonly teamId: string
  readonly athleteProfileId: string
  readonly kind: SelfDeclaredBiometricKind
  readonly valueScaled: number
  readonly observedOn: string
  readonly recordedAt: string
  readonly supersedesObservationId: string | null
  readonly source: 'athlete_declared' | 'coach_evaluated'
}

interface SelectionInput {
  readonly observations: readonly SelfDeclaredBiometricObservation[]
  readonly teamId: string
  readonly athleteProfileId: string
  readonly effectiveOn: string
  readonly knownAt: string
}

export interface SelfDeclaredBiometricSelection {
  readonly weight: SelfDeclaredBiometricObservation | null
  readonly height: SelfDeclaredBiometricObservation | null
  readonly maxHr: SelfDeclaredBiometricObservation | null
  readonly restHr: SelfDeclaredBiometricObservation | null
}

function latestForKind(
  records: readonly SelfDeclaredBiometricObservation[],
  kind: SelfDeclaredBiometricKind,
  effectiveOn: string,
): SelfDeclaredBiometricObservation | null {
  const relevant = records.filter((record) => record.kind === kind)
  const superseded = new Set(
    relevant.flatMap((record) => record.supersedesObservationId ? [record.supersedesObservationId] : []),
  )

  // Only visible revision-chain leaves are eligible. A future-effective
  // correction supersedes its original even when it is not yet effective.
  const eligible = relevant.filter((record) =>
    !superseded.has(record.id) && record.observedOn <= effectiveOn,
  )

  eligible.sort((a, b) =>
    b.observedOn.localeCompare(a.observedOn)
    || b.recordedAt.localeCompare(a.recordedAt)
    || a.id.localeCompare(b.id),
  )
  return eligible[0] ?? null
}

export function selectCurrentSelfDeclaredBiometrics({
  observations,
  teamId,
  athleteProfileId,
  effectiveOn,
  knownAt,
}: SelectionInput): SelfDeclaredBiometricSelection {
  // Never use unknown future knowledge or records from a different subject.
  const visible = observations.filter((record) =>
    record.teamId === teamId
    && record.athleteProfileId === athleteProfileId
    && record.source === 'athlete_declared'
    && record.recordedAt <= knownAt,
  )

  return {
    weight: latestForKind(visible, 'weight', effectiveOn),
    height: latestForKind(visible, 'height', effectiveOn),
    maxHr: latestForKind(visible, 'max_hr', effectiveOn),
    restHr: latestForKind(visible, 'rest_hr', effectiveOn),
  }
}
