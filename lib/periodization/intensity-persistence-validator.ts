import { PAM_PERCENTAGE_STEPS } from '@/lib/periodization/intensity-strategy-matrix'
import { validateIntensityStrategyLimits } from '@/lib/periodization/intensity-strategy-limits'
import { validateIntensityFeasibility } from '@/lib/periodization/intensity-feasibility-validator'

import type { IntensityStrategyDraft, MicrocycleIntensityTargetDraft } from '@/types'

const METHODS = new Set(['hr_zone', 'pam_percentage'])
const STRATEGY_SOURCES = new Set(['suggested', 'manual'])
const TARGET_SOURCES = new Set(['generated', 'manual'])
const ZONES = new Set(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
const EMPHASES = new Set(['recovery', 'aerobic', 'tempo', 'threshold', 'vo2max', 'race_specific'])

/** Rejects malformed or incoherent intensity data before any database write. */
export function assertPersistableIntensityPlanning(
  strategy: IntensityStrategyDraft,
  targets: MicrocycleIntensityTargetDraft[],
  sessionsPerWeek: number,
): void {
  const limits = validateIntensityStrategyLimits(strategy.values)
  if (!limits.isValid) throw new Error(limits.errors[0])
  if (!METHODS.has(strategy.values.defaultMethod)) throw new Error('El método de intensidad no es válido.')

  for (const source of Object.values(strategy.fieldSources)) {
    if (!STRATEGY_SOURCES.has(source)) throw new Error('La procedencia de la estrategia no es válida.')
  }

  for (const target of targets) {
    if (!EMPHASES.has(target.emphasis)) throw new Error('El énfasis semanal no es válido.')
    if (!ZONES.has(target.predominantZone)) throw new Error('La zona predominante no es válida.')

    for (const source of Object.values(target.fieldSources)) {
      if (!TARGET_SOURCES.has(source)) throw new Error('La procedencia del objetivo semanal no es válida.')
    }

    if (target.intenseSessionsTarget > strategy.values.maximumIntenseSessionsPerWeek) {
      throw new Error('El objetivo semanal supera el máximo de sesiones intensas de la estrategia.')
    }

    const feasibility = validateIntensityFeasibility({ target, sessionsPerWeek })
    if (!feasibility.isValid) throw new Error(feasibility.errors[0])

    if (target.intenseSessionsTarget === 0 && target.pamPercentageTarget !== null) {
      throw new Error('Una semana sin sesiones intensas no puede conservar un objetivo PAM.')
    }

    if (target.pamPercentageTarget !== null) {
      if (!Number.isFinite(target.pamPercentageTarget) || target.pamPercentageTarget <= 0 || target.pamPercentageTarget > 200) {
        throw new Error('El porcentaje PAM semanal debe estar entre 1 y 200.')
      }

      if (
        target.fieldSources.pamPercentageTarget === 'generated'
        && !(PAM_PERCENTAGE_STEPS as readonly number[]).includes(target.pamPercentageTarget)
      ) {
        throw new Error('El porcentaje PAM generado no coincide con un escalón permitido.')
      }
    }
  }
}
