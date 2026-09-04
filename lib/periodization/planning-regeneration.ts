import type {
  GeneratedMacrocycleDraft,
  GeneratedMicrocycleDraft,
  LoadStrategyDraft,
  TargetVolumeSource,
} from '@/types'

export interface ExistingMicrocycleVolume {
  id: string
  weekNumber: number
  targetVolumeKm: number | null
  targetVolumeSource: TargetVolumeSource
}

export type RegenerationConflictCode =
  | 'manual_volume_missing'
  | 'manual_volume_above_maximum'
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
}

export interface ReconciledPlanningRegeneration {
  planning: GeneratedMacrocycleDraft
  conflicts: RegenerationConflict[]
  preservedManualWeekNumbers: number[]
  restoredGeneratedWeekNumbers: number[]
}

function flattenGeneratedMicrocycles(planning: GeneratedMacrocycleDraft) {
  return planning.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)
}

export function reconcilePlanningRegeneration({
  generatedPlanning,
  existingMicrocycles,
  loadStrategy,
  restoreGeneratedWeekNumbers = [],
}: ReconcilePlanningRegenerationParams): ReconciledPlanningRegeneration {
  const generatedMicrocycles = flattenGeneratedMicrocycles(generatedPlanning)
  const generatedWeekNumbers = new Set(generatedMicrocycles.map((week) => week.weekNumber))
  const restoredWeekNumbers = new Set(restoreGeneratedWeekNumbers)
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
      existing.targetVolumeSource === 'manual'
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

  const reconcileMicrocycle = (
    generated: GeneratedMicrocycleDraft,
  ): GeneratedMicrocycleDraft => {
    const existing = existingByWeekNumber.get(generated.weekNumber)

    if (!existing || existing.targetVolumeSource !== 'manual') {
      return generated
    }

    if (restoredWeekNumbers.has(generated.weekNumber)) {
      restoredGeneratedWeekNumbers.push(generated.weekNumber)
      return generated
    }

    if (existing.targetVolumeKm === null || !Number.isFinite(existing.targetVolumeKm)) {
      conflicts.push({
        code: 'manual_volume_missing',
        weekNumber: existing.weekNumber,
        microcycleId: existing.id,
        message: `La semana ${existing.weekNumber} está marcada como manual pero no tiene un volumen válido.`,
      })
      return generated
    }

    preservedManualWeekNumbers.push(generated.weekNumber)

    if (existing.targetVolumeKm > loadStrategy.values.maximumWeeklyVolumeKm) {
      conflicts.push({
        code: 'manual_volume_above_maximum',
        weekNumber: existing.weekNumber,
        microcycleId: existing.id,
        message: `El volumen manual de la semana ${existing.weekNumber} supera el máximo actual de ${loadStrategy.values.maximumWeeklyVolumeKm} km.`,
      })
    }

    return {
      ...generated,
      targetVolumeKm: existing.targetVolumeKm,
      targetVolumeSource: 'manual',
    }
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
  }
}
