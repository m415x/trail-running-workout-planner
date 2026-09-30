import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const component = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')
const actions = read('app/actions/athlete-session-adjustment-actions.ts')

test('Coach form submits one unified adjustment instead of choosing dose or assignment mode', () => {
  assert.doesNotMatch(component, /name=['"]mode['"]/)
  assert.doesNotMatch(actions, /const mode =/)
  assert.match(actions, /payload|applyAthleteSessionAdjustmentRevision/)
})

test('Coach intensity editor uses the frozen typed contract', () => {
  assert.match(component, /name=['"]intensityMethod['"]/)
  assert.match(component, /hr_zone/)
  assert.match(component, /reference_percentage/)
  assert.match(component, /name=['"]zone['"]/)
  assert.match(component, /Z1/)
  assert.match(component, /Z5/)
  assert.match(component, /name=['"]referencePercentage['"]/)
  assert.doesNotMatch(component, /<Input name=['"]intensity['"]/)
})

test('Coach assignment editor submits one explicit assignment mode plus its relevant fields', () => {
  assert.match(component, /name=['"]assignmentMode['"]/)
  assert.match(component, /value=['"]omitted['"]/)
  assert.match(component, /name=['"]rescheduled['"]/)
  assert.match(component, /name=['"]stimulus['"]/)
  assert.match(component, /name=['"]stimulusType['"]/)
  assert.doesNotMatch(component, /name=['"]omitted['"]/)
})

test('one Coach submit produces one append-only revision write', () => {
  const start = actions.indexOf('export async function saveAthleteSessionAdjustment')
  const save = actions.slice(start)

  const applyRevisionCalls = [...save.matchAll(/applyRevision\(/g)]
  assert.equal(applyRevisionCalls.length, 1)
  assert.doesNotMatch(save, /applyAthleteDoseAdjustment\(/)
  assert.doesNotMatch(save, /applyAthleteAssignmentAdjustment\(/)
})

test('Coach save validates workout type instead of asserting arbitrary strings', () => {
  assert.match(actions, /isWorkoutType/)
  assert.doesNotMatch(actions, /as WorkoutType/)
})
