import type { IntensityZone } from '@/types/training/intensity.types'
import type {
  DatedTrainingSlot,
  SessionGenerationIntensityTarget,
  WeeklyIntensityAllocation,
  WeeklyIntensityDistribution,
} from '@/types/training/session-generation.types'
import { selectIntenseSlots } from '@/lib/session-generation/weekly-generation-rules'

const INTENSE_ZONE_BY_EMPHASIS: Record<
  SessionGenerationIntensityTarget['emphasis'],
  IntensityZone
> = {
  recovery: 'Z1',
  aerobic: 'Z2',
  tempo: 'Z3',
  threshold: 'Z4',
  vo2max: 'Z5',
  race_specific: 'Z4',
}

/**
 * Places the resolved weekly intensity target on dated slots.
 *
 * The planning target is authoritative: template intensity is intentionally
 * absent from this function. Non-intense sessions use the predominant zone,
 * while explicit recovery slots remain in Z1. PAM is prescribed only to the
 * selected intense stimuli when both method and target are available.
 */
export function distributeWeeklyIntensity(
  slots: DatedTrainingSlot[],
  target: SessionGenerationIntensityTarget,
): WeeklyIntensityDistribution {
  assertValidInput(slots, target)

  const intenseSlots = selectIntenseSlots(
    slots,
    target.intenseSessionsTarget,
    target.minimumRecoveryDaysBetweenIntenseSessions,
  )
  const intenseKeys = new Set(intenseSlots.map(({ slot }) => slot.key))
  const usePam = target.defaultMethod === 'pam_percentage' && target.pamPercentageTarget !== null
  const warnings: string[] = []

  if (intenseSlots.length < target.intenseSessionsTarget) {
    warnings.push(
      `Solo se pudieron ubicar ${intenseSlots.length} de ${target.intenseSessionsTarget} sesiones intensas respetando la recuperación requerida.`,
    )
  }
  if (target.defaultMethod === 'pam_percentage' && target.pamPercentageTarget === null) {
    warnings.push(
      'La estrategia usa PAM pero el microciclo no tiene un porcentaje objetivo; se utilizarán zonas de frecuencia cardíaca.',
    )
  }

  const allocations = [...slots]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(({ slot, date }): WeeklyIntensityAllocation => {
      const isIntense = intenseKeys.has(slot.key)

      if (isIntense && usePam) {
        return {
          slotKey: slot.key,
          date,
          isIntense: true,
          intensityMethod: 'pam_percentage',
          zone: null,
          pamPercentage: target.pamPercentageTarget,
        }
      }

      return {
        slotKey: slot.key,
        date,
        isIntense,
        intensityMethod: 'hr_zone',
        zone: resolveZone(slot.role === 'recovery', isIntense, target),
        pamPercentage: null,
      }
    })

  return {
    allocations,
    intenseSessionsTarget: target.intenseSessionsTarget,
    assignedIntenseSessions: intenseSlots.length,
    minimumRecoveryDaysBetweenIntenseSessions:
      target.minimumRecoveryDaysBetweenIntenseSessions,
    warnings,
  }
}

function resolveZone(
  isRecoverySlot: boolean,
  isIntense: boolean,
  target: SessionGenerationIntensityTarget,
) {
  if (isRecoverySlot) return 'Z1'
  if (isIntense) return INTENSE_ZONE_BY_EMPHASIS[target.emphasis]
  return target.predominantZone
}

function assertValidInput(
  slots: DatedTrainingSlot[],
  target: SessionGenerationIntensityTarget,
) {
  if (
    !Number.isInteger(target.intenseSessionsTarget) ||
    target.intenseSessionsTarget < 0 ||
    target.intenseSessionsTarget > slots.length
  ) {
    throw new RangeError('Intense session target must fit the selected weekly slots')
  }
  if (
    !Number.isInteger(target.minimumRecoveryDaysBetweenIntenseSessions) ||
    target.minimumRecoveryDaysBetweenIntenseSessions < 0
  ) {
    throw new RangeError('Minimum recovery days must be a non-negative integer')
  }

  const slotKeys = new Set<string>()
  const dates = new Set<string>()
  for (const { slot, date } of slots) {
    if (slotKeys.has(slot.key)) throw new RangeError(`Duplicated intensity slot: ${slot.key}`)
    if (dates.has(date)) throw new RangeError(`Duplicated intensity date: ${date}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
      throw new RangeError(`Invalid intensity date: ${date}`)
    }
    slotKeys.add(slot.key)
    dates.add(date)
  }
}
