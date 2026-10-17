import assert from 'node:assert/strict'
import test from 'node:test'

import { projectReviewSqlGenerationInputs } from '@/lib/session-generation/review-snapshot-effective-generation-inputs'
import { buildReviewGenerationInputManifest } from '@/lib/session-generation/review-snapshot-generation-input-manifest'
import { evaluateReviewSnapshotSourceFreshness } from '@/lib/session-generation/review-snapshot-source-freshness'
import type { ReviewSnapshotSqlSourceEvidence } from '@/lib/session-generation/review-snapshot-sql-source-evidence'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture(): ReviewSnapshotSqlSourceEvidence {
  return {
    ...scope,
    periodization: {
      ...scope,
      microcycles: [
        {
          id: 'week-race', macrocycleId: 'macro-a', mesocycleId: 'meso-a',
          macrocycleEndDate: '2027-06-30', macrocycleTargetRaceName: 'Alpine Race',
          macrocycleTargetRaceDistanceKm: 42, macrocycleTargetRaceElevationGain: 2000,
          period: 'competitive', weekNumber: 2, type: 'race',
          startDate: '2027-06-24', endDate: '2027-06-30',
          targetVolumeKm: 30, targetElevationGain: 600, targetDurationMin: 180,
        },
        {
          id: 'week-base', macrocycleId: 'macro-a', mesocycleId: 'meso-a',
          macrocycleEndDate: '2027-06-30', macrocycleTargetRaceName: 'Alpine Race',
          macrocycleTargetRaceDistanceKm: 42, macrocycleTargetRaceElevationGain: 2000,
          period: 'general_preparatory', weekNumber: 1, type: 'base',
          startDate: '2027-06-17', endDate: '2027-06-23',
          targetVolumeKm: 40, targetElevationGain: 700, targetDurationMin: 240,
        },
        {
          id: 'week-unready', macrocycleId: 'macro-a', mesocycleId: 'meso-a',
          macrocycleEndDate: '2027-06-30', macrocycleTargetRaceName: 'Alpine Race',
          macrocycleTargetRaceDistanceKm: 42, macrocycleTargetRaceElevationGain: 2000,
          period: 'general_preparatory', weekNumber: 3, type: 'base',
          startDate: '2027-07-01', endDate: '2027-07-07',
          targetVolumeKm: null, targetElevationGain: null, targetDurationMin: null,
        },
      ],
    },
    strategies: {
      ...scope,
      loadStrategy: { maximumWeeklyVolumeKm: 90, initialWeeklyVolumeKm: 25 },
      intensityStrategy: { defaultMethod: 'hr_zone', maximumIntenseSessionsPerWeek: 2 },
      intensityTargets: [
        {
          microcycleId: 'week-race', emphasis: 'race_specific', intenseSessionsTarget: 1,
          predominantZone: 'Z3', referencePercentageTarget: null,
          minimumRecoveryDaysBetweenIntenseSessions: 2,
        },
        {
          microcycleId: 'week-base', emphasis: 'aerobic', intenseSessionsTarget: 2,
          predominantZone: 'Z2', referencePercentageTarget: null,
          minimumRecoveryDaysBetweenIntenseSessions: 2,
        },
      ],
    },
    preferences: null,
    templates: {
      ...scope,
      templates: [{
        id: 'template-a', category: 'endurance', tags: ['easy'], title: 'Easy',
        type: 'Trail', distanceKm: 10, durationMin: 60, elevationGain: 250,
        intensityMethod: 'hr_zone', zone: 'Z2', referencePercentage: null,
        notes: null, prescriptionNotes: null, structure: null,
        trackPath: null, locationKey: null,
      }],
    },
    calendar: {
      ...scope, competitions: [{
        id: 'race-a', name: 'Calendar Race', date: '2027-06-30',
        distanceKm: 42, elevationGainM: 2000, priority: 'A',
        status: 'confirmed', description: null,
      }],
    },
  }
}

test('KAN-790 T5.3 assembles effective generation inputs with exact Coach planning context', () => {
  const result = projectReviewSqlGenerationInputs(fixture())
  assert.deepEqual(result.map(entry => entry.context.microcycleId), ['week-base', 'week-race'])
  assert.deepEqual(result[0]?.context.load, {
    targetVolumeKm: 40, targetElevationGain: 700,
    targetDurationMin: 240, maximumWeeklyVolumeKm: 90,
  })
  assert.deepEqual(result[0]?.context.intensity, {
    defaultMethod: 'hr_zone', emphasis: 'aerobic', intenseSessionsTarget: 2,
    predominantZone: 'Z2', referencePercentageTarget: null,
    minimumRecoveryDaysBetweenIntenseSessions: 2,
  })
  assert.equal(result[0]?.context.competition, null)
  assert.deepEqual(result[1]?.context.competition, {
    name: 'Alpine Race', date: '2027-06-30',
    distanceKm: 42, elevationGain: 2000,
  })
  assert.ok(result[0]?.context.pattern.slots.length)
  assert.deepEqual(result[0]?.templates[0]?.sessionDefaults, {
    title: 'Easy', type: 'Trail', locationKey: null,
    trackPath: null, structure: null, notes: null,
  })
  assert.deepEqual(result[0]?.templates[0]?.prescriptionDefaults, {
    distanceKm: 10, durationMin: 60, elevationGain: 250,
    intensity: { method: 'hr_zone', zone: 'Z2' }, notes: null,
  })
})

test('KAN-790 T5.3 source changes propagate to effective generation manifest, not a surrogate SQL hash', () => {
  const before = fixture()
  const after = structuredClone(before)
  const race = after.periodization.microcycles[0]
  // Clone is intentionally mutable at runtime; production types remain readonly.
  ;(race as { macrocycleTargetRaceDistanceKm: number }).macrocycleTargetRaceDistanceKm = 50

  const sourceManifest = (source: ReviewSnapshotSqlSourceEvidence) =>
    buildReviewGenerationInputManifest({
      groupTrainingPlanId: scope.groupTrainingPlanId,
      generationInputs: projectReviewSqlGenerationInputs(source),
    })
  assert.equal(
    evaluateReviewSnapshotSourceFreshness(sourceManifest(before), sourceManifest(after)).kind,
    'generation_stale',
  )
})

test('KAN-790 T5.3 missing required strategies cannot silently produce an empty valid snapshot', () => {
  const source = fixture()
  assert.throws(
    () => projectReviewSqlGenerationInputs({
      ...source, strategies: { ...source.strategies, loadStrategy: null },
    }),
    /missing|strategy|load|invalid/i,
  )
  assert.throws(
    () => projectReviewSqlGenerationInputs({
      ...source, strategies: { ...source.strategies, intensityStrategy: null },
    }),
    /missing|strategy|intensity|invalid/i,
  )
})
