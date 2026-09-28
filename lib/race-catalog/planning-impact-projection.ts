import type {
  CompetitionPriority,
  CompetitionStatus,
} from '@/types/training/competition-entry.types'
import type { GroupTrainingPlanStatus } from '@/types/training/periodization.types'

export interface RaceCoursePlanningImpactLinkedEntry {
  raceCourseId: string
  competitionEntry: {
    id: string
    groupTrainingPlanId: string
    name: string
    date: string
    distanceKm: number
    elevationGainM: number | null
    priority: CompetitionPriority
    status: CompetitionStatus
    description: string | null
  }
  plan: {
    id: string
    groupId: string
    planningCohortId: string | null
    sourceGroupTrainingPlanId: string | null
    title: string
    status: GroupTrainingPlanStatus
  }
  group: {
    id: string
    categoryCode: string
    levelCode: string
  }
  planningCohort: {
    id: string
    name: string
  } | null
}

export interface RaceCoursePlanningImpactItem {
  competitionEntryId: string
  competitionName: string
  competitionDate: string
  competitionPriority: CompetitionPriority
  competitionStatus: CompetitionStatus
  planId: string
  planTitle: string
  planStatus: GroupTrainingPlanStatus
  planKind: 'base' | 'variant'
  groupId: string
  groupCode: string
  planningCohortId: string | null
  planningCohortName: string | null
}

export function projectRaceCoursePlanningImpact(input: {
  raceCourseId: string
  linkedEntries: readonly RaceCoursePlanningImpactLinkedEntry[]
}): RaceCoursePlanningImpactItem[] {
  return input.linkedEntries
    .filter((entry) => entry.raceCourseId === input.raceCourseId)
    .map((entry) => ({
      competitionEntryId: entry.competitionEntry.id,
      competitionName: entry.competitionEntry.name,
      competitionDate: entry.competitionEntry.date,
      competitionPriority: entry.competitionEntry.priority,
      competitionStatus: entry.competitionEntry.status,
      planId: entry.plan.id,
      planTitle: entry.plan.title,
      planStatus: entry.plan.status,
      planKind: entry.plan.planningCohortId === null ? 'base' as const : 'variant' as const,
      groupId: entry.group.id,
      groupCode: `${entry.group.categoryCode}${entry.group.levelCode}`,
      planningCohortId: entry.planningCohort?.id ?? null,
      planningCohortName: entry.planningCohort?.name ?? null,
    }))
    .sort((first, second) => (
      first.groupCode.localeCompare(second.groupCode)
      || first.planKind.localeCompare(second.planKind)
      || first.planTitle.localeCompare(second.planTitle)
      || first.competitionEntryId.localeCompare(second.competitionEntryId)
    ))
}
