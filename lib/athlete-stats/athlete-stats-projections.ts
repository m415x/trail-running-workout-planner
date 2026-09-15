import type { AnalyticsMetricComparison, AnalyticsWindow } from '@/lib/analytics/shared/analytics-primitives'
import type { AdherenceAnalyticsProjection } from '@/lib/analytics/adherence/adherence-analytics'
import type { CompetitionAnalyticsProjection } from '@/lib/analytics/competition/competition-analytics'
import type { LoadAnalyticsProjection } from '@/lib/analytics/load/load-analytics'
import type { RealizedTrainingSummary } from '@/lib/analytics/training/training-analytics'
import type { RealizedTrainingEvolution } from '@/lib/analytics/training/training-evolution'
import type { RealizedTrainingSeriesPoint } from '@/lib/analytics/training/training-series'
import type { TrainingLoadTrendPoint } from '@/types/training/training-load.types'

export interface AthleteStatsProjectionInput {
  readonly period: AnalyticsWindow
  readonly training: RealizedTrainingSummary
  readonly trainingEvolution: RealizedTrainingEvolution
  readonly trainingSeries: readonly RealizedTrainingSeriesPoint[]
  readonly load: LoadAnalyticsProjection
  readonly adherence: AdherenceAnalyticsProjection
  readonly competition: CompetitionAnalyticsProjection
}

type AthleteMetricUnit = 'km' | 'min' | 'm' | 'sessions'

interface AthleteMetricEvidence {
  readonly knownRecords: number
  readonly observedRecords: number
}

type AthleteMetric =
  | { readonly state: 'available'; readonly value: number; readonly unit: AthleteMetricUnit; readonly evidence: AthleteMetricEvidence; readonly comparison: AnalyticsMetricComparison }
  | { readonly state: 'unknown'; readonly value: null; readonly unit: AthleteMetricUnit; readonly evidence: AthleteMetricEvidence; readonly comparison: AnalyticsMetricComparison }

export interface AthleteTrainingStatsProjection {
  readonly distance: AthleteMetric
  readonly duration: AthleteMetric
  readonly elevation: AthleteMetric
  readonly frequency: {
    readonly state: 'available' | 'unknown'
    readonly value: number | null
    readonly unit: 'sessions'
    readonly comparison: AnalyticsMetricComparison
  }
}

export type AthleteLoadSummaryProjection =
  | { readonly state: 'available'; readonly shortTermLoadAu: number | null; readonly longTermLoadAu: number | null; readonly loadBalanceAu: number | null; readonly coverageRatio: number | null }
  | { readonly state: 'insufficient_data'; readonly shortTermLoadAu: null; readonly longTermLoadAu: null; readonly loadBalanceAu: null; readonly coverageRatio: number | null }

export interface AthleteAdherenceSummaryProjection {
  readonly state: 'available' | 'insufficient_data'
  readonly value: number | null
  readonly coveragePercent: number | null
}

export interface AthleteCompetitionSummaryProjection {
  readonly name: string
  readonly date: string
  readonly distanceKm: number
  readonly elevationGainM: number | null
}

export interface AthleteStatsSummary {
  readonly period: AnalyticsWindow
  readonly training: AthleteTrainingStatsProjection
  readonly load: AthleteLoadSummaryProjection
  readonly adherence: AthleteAdherenceSummaryProjection
  readonly competition: AthleteCompetitionSummaryProjection | null
}

export interface AthleteStatsDetails {
  readonly period: AnalyticsWindow
  readonly training: AthleteTrainingStatsProjection & {
    readonly series: readonly RealizedTrainingSeriesPoint[]
  }
  readonly load: AthleteLoadSummaryProjection & {
    readonly trend: readonly TrainingLoadTrendPoint[]
  }
  readonly adherence: AthleteAdherenceSummaryProjection & {
    readonly eligiblePlannedSessions: number
    readonly confirmedOutcomeSessions: number
    readonly unknownSessions: number
  }
  readonly competition: {
    readonly primaryCompetition: AthleteCompetitionSummaryProjection | null
    readonly intermediateCompetitions: readonly AthleteCompetitionSummaryProjection[]
  }
}

function metric(source: RealizedTrainingSummary['distance'], comparison: AnalyticsMetricComparison, unit: Exclude<AthleteMetricUnit, 'sessions'>): AthleteMetric {
  const evidence = { knownRecords: source.knownRecords, observedRecords: source.observedRecords }
  return source.state === 'available'
    ? { state: 'available', value: source.value, unit, evidence, comparison }
    : { state: 'unknown', value: null, unit, evidence, comparison }
}

function frequencyMetric(source: RealizedTrainingSummary['frequency'], comparison: AnalyticsMetricComparison): AthleteTrainingStatsProjection['frequency'] {
  return source.state === 'available'
    ? { state: 'available', value: source.value, unit: 'sessions', comparison }
    : { state: 'unknown', value: null, unit: 'sessions', comparison }
}

function trainingProjection(input: AthleteStatsProjectionInput): AthleteTrainingStatsProjection {
  return {
    distance: metric(input.training.distance, input.trainingEvolution.distance, 'km'),
    duration: metric(input.training.duration, input.trainingEvolution.duration, 'min'),
    elevation: metric(input.training.elevation, input.trainingEvolution.elevation, 'm'),
    frequency: frequencyMetric(input.training.frequency, input.trainingEvolution.frequency),
  }
}

function loadProjection(source: LoadAnalyticsProjection): AthleteLoadSummaryProjection {
  if (source.state !== 'available') return { state: 'insufficient_data', shortTermLoadAu: null, longTermLoadAu: null, loadBalanceAu: null, coverageRatio: source.coverageRatio }
  return { state: 'available', shortTermLoadAu: source.latest.shortTermLoadAu, longTermLoadAu: source.latest.longTermLoadAu, loadBalanceAu: source.latest.loadBalanceAu, coverageRatio: source.coverageRatio }
}

function adherenceProjection(source: AdherenceAnalyticsProjection): AthleteAdherenceSummaryProjection {
  return { state: source.frequency.state, value: source.frequency.adherencePercent, coveragePercent: source.coverage.coveragePercent }
}

function competitionEntry(source: CompetitionAnalyticsProjection['primaryCompetition']): AthleteCompetitionSummaryProjection | null {
  if (source === null) return null
  return { name: source.name, date: source.date, distanceKm: source.distanceKm, elevationGainM: source.elevationGain ?? null }
}

export function projectAthleteStatsSummary(input: AthleteStatsProjectionInput): AthleteStatsSummary {
  return {
    period: { startDate: input.period.startDate, endDate: input.period.endDate },
    training: trainingProjection(input),
    load: loadProjection(input.load),
    adherence: adherenceProjection(input.adherence),
    competition: competitionEntry(input.competition.primaryCompetition),
  }
}

export function projectAthleteStatsDetails(input: AthleteStatsProjectionInput): AthleteStatsDetails {
  const adherence = adherenceProjection(input.adherence)
  return {
    period: { startDate: input.period.startDate, endDate: input.period.endDate },
    training: { ...trainingProjection(input), series: input.trainingSeries.map(point => ({ ...point })) },
    load: { ...loadProjection(input.load), trend: input.load.trend.map(point => ({ ...point })) },
    adherence: {
      state: adherence.state, value: adherence.value, coveragePercent: adherence.coveragePercent,
      eligiblePlannedSessions: input.adherence.coverage.eligiblePlannedSessions,
      confirmedOutcomeSessions: input.adherence.coverage.confirmedOutcomeSessions,
      unknownSessions: input.adherence.coverage.unknownSessions,
    },
    competition: {
      primaryCompetition: competitionEntry(input.competition.primaryCompetition),
      intermediateCompetitions: input.competition.intermediateCompetitions.map(entry => ({ name: entry.name, date: entry.date, distanceKm: entry.distanceKm, elevationGainM: entry.elevationGain ?? null })),
    },
  }
}
