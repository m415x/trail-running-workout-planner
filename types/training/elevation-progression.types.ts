import type { LoadStrategyValueSource } from '@/types/training/load-strategy.types'

/** A weekly vertical-gain target expressed in positive elevation meters (m+). */
export interface WeeklyElevationTarget {
  elevationGainM: number
  source: LoadStrategyValueSource
}

/**
 * Explicit absence of a vertical-gain objective.
 *
 * This state must not fall back to the category ratio during generation. It
 * represents the coach's decision to plan volume without a D+ progression.
 */
export interface DisabledElevationProgressionStrategy {
  mode: 'disabled'
  reason: 'not_configured'
}

/**
 * Effective constraints for generating weekly vertical-gain targets.
 *
 * Elevation is measured in positive meters per week. Percentages use the
 * human-readable 0-100 scale. The percentage limits are inherited from the
 * load strategy for now, while kilometer and elevation targets remain
 * independent values.
 */
export interface ProgressiveElevationStrategy {
  mode: 'progressive'
  initial: WeeklyElevationTarget
  maximum: WeeklyElevationTarget
  maximumWeeklyIncreasePercentage: number
  deloadPercentage: number
}

/** Strategy consumed by the future elevation progression generator. */
export type ElevationProgressionStrategy =
  | DisabledElevationProgressionStrategy
  | ProgressiveElevationStrategy
