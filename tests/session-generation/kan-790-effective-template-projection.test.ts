import assert from 'node:assert/strict'
import test from 'node:test'

import { projectReviewSqlWorkoutTemplates } from '@/lib/session-generation/review-snapshot-effective-templates'
import type { ReviewWorkoutTemplateCatalogueFacts } from '@/lib/session-generation/review-snapshot-workout-templates-sqlite'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }
const template = {
  id: 'template-a', category: 'endurance', tags: ['base'], title: 'Easy Trail',
  type: 'Trail', distanceKm: 12, durationMin: 75, elevationGain: 350,
  intensityMethod: 'hr_zone', zone: 'Z2', referencePercentage: null,
  notes: 'steady', prescriptionNotes: 'prescription', structure: null,
  trackPath: '/track-a', locationKey: 'mountain',
} as const

function source(templates: ReviewWorkoutTemplateCatalogueFacts['templates']): ReviewWorkoutTemplateCatalogueFacts {
  return { ...scope, templates }
}

test('KAN-790 T5.3 projects SQL template facts into the effective WorkoutTemplate domain shape', () => {
  const result = projectReviewSqlWorkoutTemplates(source([template]))
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], {
    id: 'template-a',
    teamId: 'team-a',
    category: 'endurance',
    tags: ['base'],
    archivedAt: null,
    isDeleted: false,
    sessionDefaults: {
      title: 'Easy Trail', type: 'Trail', locationKey: 'mountain',
      trackPath: '/track-a', structure: null, notes: 'steady',
    },
    prescriptionDefaults: {
      distanceKm: 12, durationMin: 75, elevationGain: 350,
      intensity: { method: 'hr_zone', zone: 'Z2' }, notes: 'prescription',
    },
  })
})

test('KAN-790 T5.3 preserves reference percentage intensity and null intensity correctly', () => {
  const results = projectReviewSqlWorkoutTemplates(source([
    { ...template, id: 'template-pct', intensityMethod: 'reference_percentage', zone: null, referencePercentage: 92 },
    { ...template, id: 'template-none', intensityMethod: null, zone: null, referencePercentage: null },
  ]))
  assert.deepEqual(results.map(item => item.prescriptionDefaults.intensity), [
    { method: 'reference_percentage', referencePercentage: 92 },
    null,
  ])
})

test('KAN-790 T5.3 invalid SQL template intensity facts fail closed instead of silently changing intent', () => {
  for (const bad of [
    { ...template, intensityMethod: 'hr_zone', zone: null },
    { ...template, intensityMethod: 'reference_percentage', zone: null, referencePercentage: null },
    { ...template, intensityMethod: 'not_a_method', zone: null, referencePercentage: null },
  ]) {
    assert.throws(() => projectReviewSqlWorkoutTemplates(source([bad])), /invalid|intensity|zone|método|method/i)
  }
})

test('KAN-790 T5.3 template projection does not mutate the source facts', () => {
  const facts = source([template])
  const before = structuredClone(facts)
  const result = projectReviewSqlWorkoutTemplates(facts)
  assert.deepEqual(facts, before)
  assert.notStrictEqual(result[0]?.tags, facts.templates[0]?.tags)
})
