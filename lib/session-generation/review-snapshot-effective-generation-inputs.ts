import type {
  IntensityEmphasis,
  IntensityMethod,
  IntensityZone,
} from '@/types/training/intensity.types'
import type { MicrocycleType, PeriodType } from '@/types/training/periodization.types'
import type { SessionGenerationInput } from '@/types/training/session-generation.types'
import { projectReviewSqlGenerationPreferences } from './review-snapshot-effective-preferences'
import { projectReviewSqlWorkoutTemplates } from './review-snapshot-effective-templates'
import type { ReviewSnapshotSqlSourceEvidence } from './review-snapshot-sql-source-evidence'

const PERIODS = new Set<string>(['general_preparatory', 'specific_preparatory', 'competitive', 'transition'])
const MICROCYCLE_TYPES = new Set<string>(['base', 'development', 'shock', 'deload', 'tapering', 'race'])
const EMPHASES = new Set<string>(['recovery', 'aerobic', 'tempo', 'threshold', 'vo2max', 'race_specific'])
const ZONES = new Set<string>(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])

function ensureSourceScope(source: ReviewSnapshotSqlSourceEvidence): void {
  for (const facts of [source.periodization, source.strategies, source.templates, source.calendar]) {
    if (facts.groupTrainingPlanId !== source.groupTrainingPlanId ||
      facts.teamId !== source.teamId || facts.groupId !== source.groupId) {
      throw new Error('Invalid generation source scope mismatch')
    }
  }
  if (source.preferences && (
    source.preferences.groupTrainingPlanId !== source.groupTrainingPlanId ||
    source.preferences.teamId !== source.teamId ||
    source.preferences.groupId !== source.groupId
  )) {
    throw new Error('Invalid generation preferences scope mismatch')
  }
}

/**
 * Transform one consistent, already Plan/Team/Group-scoped SQL read into the
 * exact generator inputs built by the current Coach planning page.
 *
 * The calendar is retained in the SQL evidence, but current generation uses
 * macrocycle race fields rather than replacing them with calendar entries.
 * This pure projection is not actor authorization, a SQL read, or a CREATE
 * operation. The caller must still guard against stale reads before writes.
 */
export function projectReviewSqlGenerationInputs(
  source: ReviewSnapshotSqlSourceEvidence,
): SessionGenerationInput[] {
  ensureSourceScope(source)
  const { loadStrategy, intensityStrategy, intensityTargets } = source.strategies
  if (!loadStrategy || !intensityStrategy) {
    throw new Error('Missing required generation load or intensity strategy')
  }
  if (intensityStrategy.defaultMethod !== 'hr_zone' &&
    intensityStrategy.defaultMethod !== 'reference_percentage') {
    throw new Error('Invalid generation intensity method')
  }

  const preferences = projectReviewSqlGenerationPreferences(source.preferences)
  const templates = projectReviewSqlWorkoutTemplates(source.templates)
  const targetByMicrocycle = new Map(intensityTargets.map(target => [target.microcycleId, target]))

  return [...source.periodization.microcycles]
    .sort((a, b) => a.startDate.localeCompare(b.startDate) ||
      a.weekNumber - b.weekNumber || a.id.localeCompare(b.id))
    .flatMap(microcycle => {
      const intensityTarget = targetByMicrocycle.get(microcycle.id)
      // Match Coach preview: unready weeks are not submitted for generation.
      if (microcycle.targetVolumeKm === null || !intensityTarget) return []
      if (!PERIODS.has(microcycle.period) ||
        !MICROCYCLE_TYPES.has(microcycle.type) ||
        !EMPHASES.has(intensityTarget.emphasis) ||
        !ZONES.has(intensityTarget.predominantZone)) {
        throw new Error('Invalid generation period or intensity target')
      }

      const input: SessionGenerationInput = {
        context: {
          teamId: source.teamId,
          groupTrainingPlanId: source.groupTrainingPlanId,
          groupId: source.groupId,
          microcycleId: microcycle.id,
          period: microcycle.period as PeriodType,
          microcycleType: microcycle.type as MicrocycleType,
          startDate: microcycle.startDate,
          endDate: microcycle.endDate,
          load: {
            targetVolumeKm: microcycle.targetVolumeKm,
            targetElevationGain: microcycle.targetElevationGain,
            targetDurationMin: microcycle.targetDurationMin,
            maximumWeeklyVolumeKm: loadStrategy.maximumWeeklyVolumeKm,
          },
          intensity: {
            defaultMethod: intensityStrategy.defaultMethod as IntensityMethod,
            emphasis: intensityTarget.emphasis as IntensityEmphasis,
            intenseSessionsTarget: intensityTarget.intenseSessionsTarget,
            predominantZone: intensityTarget.predominantZone as IntensityZone,
            referencePercentageTarget: intensityTarget.referencePercentageTarget,
            minimumRecoveryDaysBetweenIntenseSessions:
              intensityTarget.minimumRecoveryDaysBetweenIntenseSessions,
          },
          competition: microcycle.type === 'race' &&
            microcycle.macrocycleTargetRaceName &&
            microcycle.macrocycleTargetRaceDistanceKm
            ? {
                name: microcycle.macrocycleTargetRaceName,
                date: microcycle.macrocycleEndDate,
                distanceKm: microcycle.macrocycleTargetRaceDistanceKm,
                elevationGain: microcycle.macrocycleTargetRaceElevationGain,
              }
            : null,
          frequency: preferences.frequency,
          pattern: preferences.pattern,
        },
        templates,
      }
      return [input]
    })
}
