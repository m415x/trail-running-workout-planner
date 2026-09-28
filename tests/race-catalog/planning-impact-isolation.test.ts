import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  projectRaceCoursePlanningImpact,
} from '@/lib/race-catalog/planning-impact-projection'

describe('KAN-519 race course planning impact isolation', () => {
  it('keeps independent variants from different sporting groups on the same race course', () => {
    const result = projectRaceCoursePlanningImpact({
      raceCourseId: 'course-shared',
      linkedEntries: [
        {
          raceCourseId: 'course-shared',
          competitionEntry: {
            id: 'entry-s2',
            groupTrainingPlanId: 'variant-s2',
            name: 'Shared race',
            date: '2026-12-01',
            distanceKm: 30,
            elevationGainM: 1500,
            priority: 'A',
            status: 'confirmed',
            description: null,
          },
          plan: {
            id: 'variant-s2',
            groupId: 'group-s2',
            planningCohortId: 'cohort-s2',
            sourceGroupTrainingPlanId: 'base-s2',
            title: 'S2 variant',
            status: 'draft',
          },
          group: {
            id: 'group-s2',
            categoryCode: 'S',
            levelCode: '2',
          },
          planningCohort: {
            id: 'cohort-s2',
            name: 'S2 spring',
          },
        },
        {
          raceCourseId: 'course-shared',
          competitionEntry: {
            id: 'entry-m1',
            groupTrainingPlanId: 'variant-m1',
            name: 'Shared race',
            date: '2026-12-01',
            distanceKm: 30,
            elevationGainM: 1500,
            priority: 'B',
            status: 'planned',
            description: null,
          },
          plan: {
            id: 'variant-m1',
            groupId: 'group-m1',
            planningCohortId: 'cohort-m1',
            sourceGroupTrainingPlanId: 'base-m1',
            title: 'M1 variant',
            status: 'draft',
          },
          group: {
            id: 'group-m1',
            categoryCode: 'M',
            levelCode: '1',
          },
          planningCohort: {
            id: 'cohort-m1',
            name: 'M1 mountain',
          },
        },
      ],
    })

    assert.equal(result.length, 2)

    const s2 = result.find((item) => item.groupId === 'group-s2')
    const m1 = result.find((item) => item.groupId === 'group-m1')

    assert.ok(s2)
    assert.ok(m1)
    assert.equal(s2.planningCohortId, 'cohort-s2')
    assert.equal(s2.planId, 'variant-s2')
    assert.equal(s2.competitionEntryId, 'entry-s2')
    assert.equal(m1.planningCohortId, 'cohort-m1')
    assert.equal(m1.planId, 'variant-m1')
    assert.equal(m1.competitionEntryId, 'entry-m1')
  })

  it('rejects a projected variant whose planning subgroup belongs to another sporting group', () => {
    assert.throws(() => projectRaceCoursePlanningImpact({
      raceCourseId: 'course-shared',
      linkedEntries: [
        {
          raceCourseId: 'course-shared',
          competitionEntry: {
            id: 'entry-cross',
            groupTrainingPlanId: 'variant-s2',
            name: 'Shared race',
            date: '2026-12-01',
            distanceKm: 30,
            elevationGainM: 1500,
            priority: 'A',
            status: 'confirmed',
            description: null,
          },
          plan: {
            id: 'variant-s2',
            groupId: 'group-s2',
            planningCohortId: 'cohort-m1',
            sourceGroupTrainingPlanId: 'base-s2',
            title: 'Invalid cross-group variant',
            status: 'draft',
          },
          group: {
            id: 'group-s2',
            categoryCode: 'S',
            levelCode: '2',
          },
          planningCohort: {
            id: 'cohort-m1',
            name: 'M1 mountain',
            groupId: 'group-m1',
          },
        },
      ],
    }), /planning subgroup.*sporting group/i)
  })
})
