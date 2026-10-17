import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'
import { buildGenerationExplanation, GENERATION_EXPLANATION_STAGE_ORDER } from '@/lib/session-generation/generation-explanation'
import { generateWeeklySessionProposals } from '@/lib/session-generation/session-proposal-generator'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import type { SessionGenerationInput } from '@/types/training/session-generation.types'

const PLAN = 'kan791-annual-plan'
const GROUP = 'kan791-annual-group'
const TEAM = 'kan791-annual-team'
const START = '2026-01-05'
const WEEKS = 53
const HIGH_LOAD_WEEKS = 27
const MAX_VOLUME = 60

function isoWeek(index: number, offset: number): string {
  const date = new Date(START + 'T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() + 7 * index + offset)
  return date.toISOString().slice(0, 10)
}

/**
 * Deterministic representative source facts: 27 development weeks at 85% of
 * maximum volume (AUTO => five real slots), 26 at 70% (AUTO => four).
 * Distinct from historical source reconstruction. No padded events or mocks.
 */
function inputForWeek(index: number): SessionGenerationInput {
  return {
    context: {
      teamId: TEAM,
      groupTrainingPlanId: PLAN,
      groupId: GROUP,
      microcycleId: 'kan791-microcycle-' + String(index + 1).padStart(2, '0'),
      period: index < 27 ? 'general_preparatory' : 'specific_preparatory',
      microcycleType: 'development',
      startDate: isoWeek(index, 0),
      endDate: isoWeek(index, 6),
      load: {
        targetVolumeKm: index < HIGH_LOAD_WEEKS ? MAX_VOLUME * 0.85 : MAX_VOLUME * 0.70,
        targetElevationGain: 700,
        maximumWeeklyVolumeKm: MAX_VOLUME,
      },
      intensity: {
        defaultMethod: 'reference_percentage',
        emphasis: 'vo2max',
        intenseSessionsTarget: 1,
        predominantZone: 'Z2',
        referencePercentageTarget: 95,
        minimumRecoveryDaysBetweenIntenseSessions: 2,
      },
      competition: null,
      frequency: { mode: 'auto' },
      pattern: DEFAULT_WEEKLY_TRAINING_PATTERN,
    },
    templates: [],
  }
}

test('KAN-791 representative 53 consecutive weeks yield exactly 239 genuine grouped events and complete explanations', () => {
  const inputs = Array.from({ length: WEEKS }, (_, index) => inputForWeek(index))
  assert.equal(inputs.length, 53)
  for (let index = 0; index < WEEKS; index++) {
    assert.equal(inputs[index]!.context.startDate, isoWeek(index, 0))
    assert.equal(inputs[index]!.context.endDate, isoWeek(index, 6))
    if (index > 0) assert.equal(
      inputs[index]!.context.startDate,
      isoWeek(index - 1, 7),
    )
  }
  const runs = inputs.map(input => ({input, result:generateWeeklySessionProposals(input)}))
  assert.deepEqual(runs.map(run => run.result.proposals.length), [
    ...Array<number>(27).fill(5),
    ...Array<number>(26).fill(4),
  ])
  const grouped = groupSharedSessionEvents(runs.map(run => run.result))
  assert.equal(grouped.events.length, 239)
  assert.equal(new Set(grouped.events.map(event => event.sharedEventKey)).size, 239)
  const prescriptions = grouped.events.flatMap(event => event.prescriptions)
  assert.equal(prescriptions.length, 239)
  assert.equal(new Set(prescriptions.map(item => item.generationKey)).size, 239)
  const explanations = runs.flatMap(({input,result}) =>
    result.proposals.map(item => buildGenerationExplanation({
      input, result, sharedGeneration:grouped,
      generationKey:item.generationKey, planningCohortId:null,
    })),
  )
  assert.equal(explanations.length, 239)
  assert.ok(explanations.every(value => value.planningScope.kind === 'base'))
  assert.ok(explanations.every(value => value.stages.length === GENERATION_EXPLANATION_STAGE_ORDER.length))
})
