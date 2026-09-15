import { projectAdherenceAnalytics } from '@/lib/analytics/adherence/adherence-analytics'
import { projectCompetitionAnalytics } from '@/lib/analytics/competition/competition-analytics'
import { projectLoadAnalytics } from '@/lib/analytics/load/load-analytics'
import { summarizeRealizedTraining } from '@/lib/analytics/training/training-analytics'
import { compareRealizedTraining } from '@/lib/analytics/training/training-evolution'
import { projectRealizedTrainingSeries } from '@/lib/analytics/training/training-series'
import type { AthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-projections'
import type { AthleteStatsSubject } from '@/lib/athlete-stats/athlete-stats-read-service'
import type { AthleteAdherence } from '@/types/training/adherence.types'
import type { CompetitionContext } from '@/types/training/competition-context.types'
import type { AthleteTrainingLoadState } from '@/types/training/training-load.types'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

interface SubjectPeriod extends AthleteStatsSubject {
  readonly startDate: string
  readonly endDate: string
}

export interface AthleteStatsSourceDependencies {
  readonly listRealizedTraining: (input: SubjectPeriod) => Promise<readonly RealizedTrainingRecord[]>
  readonly getTrainingLoad: (input: SubjectPeriod) => Promise<AthleteTrainingLoadState>
  readonly getAdherence: (input: SubjectPeriod) => Promise<AthleteAdherence>
  readonly getCompetitionContext: (input: SubjectPeriod) => Promise<CompetitionContext>
}

function previousPeriod(period: { readonly startDate: string; readonly endDate: string }) {
  const start = new Date(`${period.startDate}T00:00:00Z`)
  const end = new Date(`${period.endDate}T00:00:00Z`)
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const previousEnd = new Date(start)
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setUTCDate(previousEnd.getUTCDate() - durationDays + 1)
  return { startDate: previousStart.toISOString().slice(0, 10), endDate: previousEnd.toISOString().slice(0, 10) }
}

/** Composes KAN-351 analytics strictly from their existing authoritative sources. */
export async function loadAthleteStatsProjectionInput(
  subject: AthleteStatsSubject,
  period: { readonly startDate: string; readonly endDate: string },
  dependencies: AthleteStatsSourceDependencies,
): Promise<AthleteStatsProjectionInput> {
  const previous = previousPeriod(period)
  const currentScope = { ...subject, ...period }
  const previousScope = { ...subject, ...previous }

  const [currentRecords, previousRecords, load, adherence, competition] = await Promise.all([
    dependencies.listRealizedTraining(currentScope),
    dependencies.listRealizedTraining(previousScope),
    dependencies.getTrainingLoad(currentScope),
    dependencies.getAdherence(currentScope),
    dependencies.getCompetitionContext(currentScope),
  ])

  const training = summarizeRealizedTraining(currentRecords)
  const previousTraining = summarizeRealizedTraining(previousRecords)

  return {
    period,
    training,
    trainingEvolution: compareRealizedTraining(training, previousTraining),
    trainingSeries: projectRealizedTrainingSeries(currentRecords),
    load: projectLoadAnalytics(load),
    adherence: projectAdherenceAnalytics(adherence),
    competition: projectCompetitionAnalytics(competition),
  }
}
