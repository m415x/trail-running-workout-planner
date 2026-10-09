import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('features/workouts/HomeTab.tsx', 'utf8')
const hook = readFileSync('features/workouts/hooks/useHomeTab.ts', 'utf8')

test('KAN-704 Home week callbacks preserve failed action results instead of laundering them into authorized empty arrays', () => {
  assert.doesNotMatch(home, /return result\.success && result\.data \? result\.data\.sessions : \[\]/)
  assert.doesNotMatch(home, /return result\.success \? result\.data : \[\]/)
  assert.match(home, /status:\s*['"]denied['"]|status:\s*['"]error['"]/)
  assert.match(home, /status:\s*['"]loaded['"]|status:\s*['"]success['"]/)
})

test('KAN-704 hook retains distinct denied/error/loaded states and clears privileged projections on failed week reads', () => {
  assert.match(hook, /weekLoadState|weekAccessState/)
  assert.match(hook, /['"]denied['"]/)
  assert.match(hook, /['"]error['"]/)
  assert.match(hook, /setSchedule\(\[\]\)/)
  assert.match(hook, /setRealizedTraining\(\[\]\)/)
  assert.doesNotMatch(hook, /setSchedule\(newSchedule\)\s*\n\s*setRealizedTraining\(newRealizedTraining\)/)
})

test('KAN-704 Home renders DENY/error feedback instead of RestCard or historic privileged content', () => {
  assert.match(home, /weekLoadState|weekAccessState/)
  assert.match(home, /AthletePageState/)
  assert.match(home, /captureState|weekLoadState|weekAccessState/)
})
