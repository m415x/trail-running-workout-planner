import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-359/T9f Athlete Plan page adopts scoped typography for hierarchy and supporting text', () => {
  const source = read('app/[locale]/(mobile)/plan/page.tsx')

  assert.match(source, /--athlete-text-heading/, 'Plan heading must respond to the Athlete preset')
  assert.match(source, /--athlete-text-caption/, 'Plan dates or supporting captions must respond to the Athlete preset')
  assert.match(source, /--athlete-text-body-compact/, 'Plan descriptive content must respond to the Athlete preset')
  assert.match(source, /AthleteSessionCard/, 'Plan must preserve its existing session presentation')
  assert.match(source, /AthletePageState/, 'Plan must preserve its existing error-state component')
})

test('KAN-359/T9f Athlete session title and readable body adopt Athlete scoped roles', () => {
  const source = read('features/athlete-planning/components/AthleteSessionCard.tsx')

  assert.match(source, /--athlete-text-title/, 'Session title must respond to the Athlete preset')
  assert.match(source, /--athlete-text-body-compact/, 'Session details must respond to the Athlete preset')
  assert.match(source, /formatIntensity\(/, 'Session intensity presentation must remain available')
})

test('KAN-359/T9f Athlete Plan error state responds to preset without changing its alert semantics', () => {
  const source = read('features/athlete-planning/components/AthletePageState.tsx')

  assert.match(source, /--athlete-text-body-compact/, 'Plan feedback must respond to the Athlete preset')
  assert.match(source, /role='alert'/, 'Existing accessible error announcement must be preserved')
})
