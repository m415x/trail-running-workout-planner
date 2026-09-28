import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  projectRaceCoursePlanningImpact,
} from '@/lib/race-catalog/planning-impact-projection'

describe('KAN-519 race course planning impact projection', () => {
  it('keeps one linked competition entry per owning plan and exposes independent group/cohort audiences', () => {
    const result = projectRaceCoursePlanningImpact({
      raceCourseId: 'course-42',
      linkedEntries: [
        {
          raceCourseId: 'course-42',
          competitionEntry: {
            id: 'entry-base-s2',
            groupTrainingPlanId: 'base-s2',
            name: 'Patagonia Run 42K',
            date: '2026-11-16',
            distanceKm: 42,
            elevationGainM: 2200,
            priority: 'A',
            status: 'confirmed',
            description: null,
          },
          plan: {
            id: 'base-s2',
            groupId: 'group-s2',
            planningCohortId: null,
            sourceGroupTrainingPlanId: null,
            title: 'Plan base S2',
            status: 'active',
          },
          group: {
            id: 'group-s2',
            categoryCode: 'S',
            levelCode: '2',
          },
          planningCohort: null,
        },
        {
          raceCourseId: 'course-42',
          competitionEntry: {
            id: 'entry-variant-s2',
            groupTrainingPlanId: 'variant-s2',
            name: 'Patagonia Run 42K',
            date: '2026-11-16',
            distanceKm: 42,
            elevationGainM: 2200,
            priority: 'A',
            status: 'confirmed',
            description: null,
          },
          plan: {
            id: 'variant-s2',
            groupId: 'group-s2',
            planningCohortId: 'cohort-s2',
            sourceGroupTrainingPlanId: 'base-s2',
            title: 'Short Trail primavera · Variante',
            status: 'draft',
          },
          group: {
            id: 'group-s2',
            categoryCode: 'S',
            levelCode: '2',
          },
          planningCohort: {
            id: 'cohort-s2',
            name: 'Short Trail primavera',
          },
        },
        {
          raceCourseId: 'course-42',
          competitionEntry: {
            id: 'entry-variant-m1',
            groupTrainingPlanId: 'variant-m1',
            name: 'Patagonia Run 42K',
            date: '2026-11-16',
            distanceKm: 42,
            elevationGainM: 2200,
            priority: 'B',
            status: 'planned',
            description: null,
          },
          plan: {
            id: 'variant-m1',
            groupId: 'group-m1',
            planningCohortId: 'cohort-m1',
            sourceGroupTrainingPlanId: 'base-m1',
            title: 'Maratón montaña · Variante',
            status: 'draft',
          },
          group: {
            id: 'group-m1',
            categoryCode: 'M',
            levelCode: '1',
          },
          planningCohort: {
            id: 'cohort-m1',
            name: 'Maratón montaña',
          },
        },
      ],
    })

    assert.deepEqual(result.map((item) => ({
      competitionEntryId: item.competitionEntryId,
      planId: item.planId,
      planKind: item.planKind,
      groupCode: item.groupCode,
      planningCohortId: item.planningCohortId,
      planningCohortName: item.planningCohortName,
    })), [
      {
        competitionEntryId: 'entry-variant-m1',
        planId: 'variant-m1',
        planKind: 'variant',
        groupCode: 'M1',
        planningCohortId: 'cohort-m1',
        planningCohortName: 'Maratón montaña',
      },
      {
        competitionEntryId: 'entry-base-s2',
        planId: 'base-s2',
        planKind: 'base',
        groupCode: 'S2',
        planningCohortId: null,
        planningCohortName: null,
      },
      {
        competitionEntryId: 'entry-variant-s2',
        planId: 'variant-s2',
        planKind: 'variant',
        groupCode: 'S2',
        planningCohortId: 'cohort-s2',
        planningCohortName: 'Short Trail primavera',
      },
    ])
  })

  it('does not infer planning impact from unlinked lookalike entries', () => {
    const result = projectRaceCoursePlanningImpact({
      raceCourseId: 'course-42',
      linkedEntries: [
        {
          raceCourseId: 'different-course',
          competitionEntry: {
            id: 'lookalike',
            groupTrainingPlanId: 'base-s2',
            name: 'Patagonia Run 42K',
            date: '2026-11-16',
            distanceKm: 42,
            elevationGainM: 2200,
            priority: 'A',
            status: 'confirmed',
            description: null,
          },
          plan: {
            id: 'base-s2',
            groupId: 'group-s2',
            planningCohortId: null,
            sourceGroupTrainingPlanId: null,
            title: 'Plan base S2',
            status: 'active',
          },
          group: {
            id: 'group-s2',
            categoryCode: 'S',
            levelCode: '2',
          },
          planningCohort: null,
        },
      ],
    })

    assert.deepEqual(result, [])
  })
})
