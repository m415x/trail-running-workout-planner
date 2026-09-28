import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import * as coreSchema from '@/db/schema'
import * as competitionSchema from '@/db/competition-entry-schema'
import * as raceCatalogSchema from '@/db/race-catalog-schema'
import {
  athleteGroups,
  groupTrainingPlans,
  planningCohorts,
} from '@/db/schema'
import { competitionEntries } from '@/db/competition-entry-schema'
import { competitionEntryRaceCourses } from '@/db/race-catalog-schema'
import {
  projectRaceCoursePlanningImpact,
  type RaceCoursePlanningImpactItem,
  type RaceCoursePlanningImpactLinkedEntry,
} from '@/lib/race-catalog/planning-impact-projection'

type PlanningImpactSchema =
  typeof coreSchema
  & typeof competitionSchema
  & typeof raceCatalogSchema

export function loadRaceCoursePlanningImpactSynchronously(input: {
  db: BetterSQLite3Database<PlanningImpactSchema>
  teamId: string
  raceCourseId: string
}): RaceCoursePlanningImpactItem[] {
  const rows = input.db
    .select({
      linkRaceCourseId: competitionEntryRaceCourses.raceCourseId,
      competitionEntry: competitionEntries,
      plan: groupTrainingPlans,
      group: athleteGroups,
      planningCohort: planningCohorts,
    })
    .from(competitionEntryRaceCourses)
    .innerJoin(
      competitionEntries,
      eq(
        competitionEntryRaceCourses.competitionEntryId,
        competitionEntries.id,
      ),
    )
    .innerJoin(
      groupTrainingPlans,
      eq(competitionEntries.groupTrainingPlanId, groupTrainingPlans.id),
    )
    .innerJoin(
      athleteGroups,
      eq(groupTrainingPlans.groupId, athleteGroups.id),
    )
    .leftJoin(
      planningCohorts,
      eq(groupTrainingPlans.planningCohortId, planningCohorts.id),
    )
    .where(and(
      eq(competitionEntryRaceCourses.raceCourseId, input.raceCourseId),
      eq(competitionEntries.isDeleted, false),
      eq(groupTrainingPlans.isDeleted, false),
      eq(athleteGroups.isDeleted, false),
      eq(athleteGroups.teamId, input.teamId),
    ))
    .all()

  const linkedEntries: RaceCoursePlanningImpactLinkedEntry[] = rows.map((row) => ({
    raceCourseId: row.linkRaceCourseId,
    competitionEntry: {
      id: row.competitionEntry.id,
      groupTrainingPlanId: row.competitionEntry.groupTrainingPlanId,
      name: row.competitionEntry.name,
      date: row.competitionEntry.date,
      distanceKm: row.competitionEntry.distanceKm,
      elevationGainM: row.competitionEntry.elevationGainM,
      priority: row.competitionEntry.priority,
      status: row.competitionEntry.status,
      description: row.competitionEntry.description,
    },
    plan: {
      id: row.plan.id,
      groupId: row.plan.groupId,
      planningCohortId: row.plan.planningCohortId,
      sourceGroupTrainingPlanId: row.plan.sourceGroupTrainingPlanId,
      title: row.plan.title,
      status: row.plan.status,
    },
    group: {
      id: row.group.id,
      categoryCode: row.group.categoryCode,
      levelCode: row.group.levelCode,
    },
    planningCohort: row.planningCohort && !row.planningCohort.isDeleted
      ? {
          id: row.planningCohort.id,
          name: row.planningCohort.name,
        }
      : null,
  }))

  return projectRaceCoursePlanningImpact({
    raceCourseId: input.raceCourseId,
    linkedEntries,
  })
}
