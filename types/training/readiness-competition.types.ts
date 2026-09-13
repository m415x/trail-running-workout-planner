import type { CompetitionDemandAssessment } from '@/types/training/competitive-adjustment.types'
import type { CompetitionEntry, CompetitionPriority } from '@/types/training/competition-entry.types'
import type { CompetitionImpactWindow } from '@/types/training/competition-impact-window.types'
import type { PlanningReviewScope } from '@/types/training/planning-review.types'

export interface ReadinessCompetitionTarget {
  readonly scope: PlanningReviewScope
  readonly competitionEntryId: string
  readonly name: string
  readonly date: string
  readonly distanceKm: number
  readonly elevationGainM: number | null
  readonly priority: CompetitionPriority
  readonly demand: CompetitionDemandAssessment
  readonly impactWindow: CompetitionImpactWindow | null
}

export type ReadinessCompetitionTargetResolution =
  | {
      readonly status: 'resolved'
      readonly source: 'explicit_selection' | 'primary_competition'
      readonly target: ReadinessCompetitionTarget
    }
  | {
      readonly status: 'selection_required'
      readonly applicableCompetitions: readonly CompetitionEntry[]
    }
  | {
      readonly status: 'unavailable'
      readonly reason:
        | 'athlete_planning_not_resolved'
        | 'competition_context_invalid'
        | 'no_applicable_competition'
        | 'selected_competition_not_applicable'
    }
