import type {
  GeneratedMacrocycleDraft,
  GeneratedMicrocycleDraft,
  LoadStrategyDraft,
  TargetElevationSource,
  TargetVolumeSource,
} from '@/types'

export interface ExistingMicrocycleVolume {
  id: string
  weekNumber: number
  targetVolumeKm: number | null
  targetVolumeSource: TargetVolumeSource
  targetElevationGain: number | null
  targetElevationSource: TargetElevationSource
}

export type RegenerationConflictCode =
  | 'manual_volume_missing'
  | 'manual_volume_above_maximum'
  | 'manual_elevation_above_maximum'
  | 'manual_week_outside_horizon'
  | 'duplicate_week_number'

export interface RegenerationConflict {
  code: RegenerationConflictCode
  weekNumber: number
  microcycleId: string
  message: string
}

export interface ReconcilePlanningRegenerationParams {
  generatedPlanning: GeneratedMacrocycleDraft
  existingMicrocycles: ExistingMicrocycleVolume[]
  loadStrategy: LoadStrategyDraft
  restoreGeneratedWeekNumbers?: number[]
  restoreGeneratedElevationWeekNumbers?: number[]
}

export interface ReconciledPlanningRegeneration {
  planning: GeneratedMacrocycleDraft
  conflicts: RegenerationConflict[]
  preservedManualWeekNumbers: number[]
  restoredGeneratedWeekNumbers: number[]
  preservedManualElevationWeekNumbers: number[]
  restoredGeneratedElevationWeekNumbers: number[]
}

function flattenGeneratedMicrocycles(planning: GeneratedMacrocycleDraft) {
  return planning.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)
}

export function reconcilePlanningRegeneration({
  generatedPlanning,
  existingMicrocycles,
  loadStrategy,
  restoreGeneratedWeekNumbers = [],
  restoreGeneratedElevationWeekNumbers = [],
}: ReconcilePlanningRegenerationParams): ReconciledPlanningRegeneration {
  const generatedMicrocycles = flattenGeneratedMicrocycles(generatedPlanning)
  const generatedWeekNumbers = new Set(generatedMicrocycles.map((week) => week.weekNumber))
  const restoredWeekNumbers = new Set(restoreGeneratedWeekNumbers)
  const restoredElevationWeekNumbers = new Set(restoreGeneratedElevationWeekNumbers)
  const existingByWeekNumber = new Map<number, ExistingMicrocycleVolume>()
  const conflicts: RegenerationConflict[] = []

  for (const existing of existingMicrocycles) {
    const duplicate = existingByWeekNumber.get(existing.weekNumber)

    if (duplicate) {
      conflicts.push({
        code: 'duplicate_week_number',
        weekNumber: existing.weekNumber,
        microcycleId: existing.id,
        message: `La semana ${existing.weekNumber} aparece más de una vez en la planificación existente.`,
      })
      continue
    }

    existingByWeekNumber.set(existing.weekNumber, existing)

    if (
      (existing.targetVolumeSource === 'manual' || existing.targetElevationSource === 'manual')
      && !generatedWeekNumbers.has(existing.weekNumber)
    ) {
      conflicts.push({
        code: 'manual_week_outside_horizon',
        weekNumber: existing.weekNumber,
        microcycleId: existing.id,
        message: `La semana manual ${existing.weekNumber} queda fuera del nuevo horizonte.`,
      })
    }
  }

  const preservedManualWeekNumbers: number[] = []
  const restoredGeneratedWeekNumbers: number[] = []
  const preservedManualElevationWeekNumbers: number[] = []
  const restoredGeneratedElevationWeekNumbers: number[] = []

  const reconcileMicrocycle = (
    generated: GeneratedMicrocycleDraft,
  ): GeneratedMicrocycleDraft => {
    const existing = existingByWeekNumber.get(generated.weekNumber)

    if (!existing) {
      return generated
    }

    let reconciled = generated

    if (existing.targetVolumeSource === 'manual') {
      if (restoredWeekNumbers.has(generated.weekNumber)) {
        restoredGeneratedWeekNumbers.push(generated.weekNumber)
      } else if (existing.targetVolumeKm === null || !Number.isFinite(existing.targetVolumeKm)) {
        conflicts.push({
          code: 'manual_volume_missing',
          weekNumber: existing.weekNumber,
          microcycleId: existing.id,
          message: `La semana ${existing.weekNumber} está marcada como manual pero no tiene un volumen válido.`,
        })
      } else {
        preservedManualWeekNumbers.push(generated.weekNumber)

        if (existing.targetVolumeKm > loadStrategy.values.maximumWeeklyVolumeKm) {
          conflicts.push({
            code: 'manual_volume_above_maximum',
            weekNumber: existing.weekNumber,
            microcycleId: existing.id,
            message: `El volumen manual de la semana ${existing.weekNumber} supera el máximo actual de ${loadStrategy.values.maximumWeeklyVolumeKm} km.`,
          })
        }

        reconciled = {
          ...reconciled,
          targetVolumeKm: existing.targetVolumeKm,
          targetVolumeSource: 'manual',
        }
      }
    }

    if (existing.targetElevationSource === 'manual') {
      if (restoredElevationWeekNumbers.has(generated.weekNumber)) {
        restoredGeneratedElevationWeekNumbers.push(generated.weekNumber)
      } else {
        preservedManualElevationWeekNumbers.push(generated.weekNumber)

        if (
          existing.targetElevationGain !== null
          && loadStrategy.values.maximumWeeklyElevationGain !== null
          && existing.targetElevationGain > loadStrategy.values.maximumWeeklyElevationGain
        ) {
          conflicts.push({
            code: 'manual_elevation_above_maximum',
            weekNumber: existing.weekNumber,
            microcycleId: existing.id,
            message: `El D+ manual de la semana ${existing.weekNumber} supera el máximo actual de ${loadStrategy.values.maximumWeeklyElevationGain} m.`,
          })
        }

        reconciled = {
          ...reconciled,
          targetElevationGain: existing.targetElevationGain,
          targetElevationSource: 'manual',
        }
      }
    }

    return reconciled
  }

  const planning: GeneratedMacrocycleDraft = {
    ...generatedPlanning,
    mesocycles: generatedPlanning.mesocycles.map((mesocycle) => ({
      ...mesocycle,
      microcycles: mesocycle.microcycles.map(reconcileMicrocycle),
    })),
  }

  return {
    planning,
    conflicts,
    preservedManualWeekNumbers: preservedManualWeekNumbers.sort((a, b) => a - b),
    restoredGeneratedWeekNumbers: restoredGeneratedWeekNumbers.sort((a, b) => a - b),
    preservedManualElevationWeekNumbers: preservedManualElevationWeekNumbers.sort((a, b) => a - b),
    restoredGeneratedElevationWeekNumbers: restoredGeneratedElevationWeekNumbers.sort((a, b) => a - b),
  }
}
