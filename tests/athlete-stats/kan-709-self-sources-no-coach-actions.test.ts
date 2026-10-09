import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adherence = readFileSync('lib/athlete-stats/athlete-stats-adherence-source.ts', 'utf8')
const competition = readFileSync('lib/athlete-stats/athlete-stats-competition-source.ts', 'utf8')

test('KAN-709 Stats adherence does not call Coach-facing plan-real Server Action', () => {
  assert.doesNotMatch(adherence, /from ['"]@\/app\/actions\/realized-training-actions['"]/)
  assert.doesNotMatch(adherence, /getAthletePlanRealComparisonAction/)
  assert.match(adherence, /input\.teamId/)
})

test('KAN-709 Stats competition does not call Coach-authorized planning Server Action', () => {
  assert.doesNotMatch(competition, /from ['"]@\/app\/actions\/planning-cohort-actions['"]/)
  assert.doesNotMatch(competition, /getAthletePlanningResolutionOnDate/)
  assert.match(competition, /input\.teamId/)
})
