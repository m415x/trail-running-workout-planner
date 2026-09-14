import { deriveDailyTrainingLoad } from '@/lib/training-load/daily-training-load'
import {
  TRAINING_LOAD_RULE_CONFIG,
  type RealizedTrainingRecord,
  type TrainingLoadEvidenceWindow,
  type TrainingLoadInsufficientReason,
} from '@/types'

export interface BuildTrainingLoadEvidenceWindowInput {
  readonly startDate: string
  readonly endDate: string
  readonly records: readonly RealizedTrainingRecord[]
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

export function buildTrainingLoadEvidenceWindow(
  input: BuildTrainingLoadEvidenceWindowInput,
): TrainingLoadEvidenceWindow {
  const dates = enumerateDates(input.startDate, input.endDate)
  const days = dates.map(date => deriveDailyTrainingLoad(date, input.records))

  const knownLoadDays = days.filter(day => day.state === 'known_load').length
  const confirmedRestDays = days.filter(day => day.state === 'confirmed_rest').length
  const unknownLoadDays = days.filter(day => day.state === 'unknown_load').length
  const noEvidenceDays = days.filter(day => day.state === 'no_evidence').length
  const usableDays = knownLoadDays + confirmedRestDays
  const observedDays = days.length

  const insufficientReasons: TrainingLoadInsufficientReason[] = []
  if (usableDays === 0) insufficientReasons.push('no_reliable_evidence')
  if (observedDays < TRAINING_LOAD_RULE_CONFIG.minimumWarmupDays) {
    insufficientReasons.push('insufficient_history')
  }

  const status = usableDays === 0
    ? 'insufficient_data'
    : observedDays < TRAINING_LOAD_RULE_CONFIG.minimumWarmupDays
      ? 'warming_up'
      : 'available'

  return {
    startDate: input.startDate,
    endDate: input.endDate,
    status,
    insufficientReasons,
    coverage: {
      observedDays,
      knownLoadDays,
      confirmedRestDays,
      unknownLoadDays,
      noEvidenceDays,
      usableDays,
      coverageRatio: observedDays === 0 ? null : usableDays / observedDays,
    },
    days,
  }
}
