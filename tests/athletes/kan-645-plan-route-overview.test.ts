import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')

test('KAN-645/I3 integrates the existing planned multiweek projections into /plan', () => {
  assert.match(page, /buildAthletePlanOverview\(/)
  assert.match(page, /projectAthletePlannedWeeklyVolume\(/)
  assert.match(page, /overview\.weeks/)
  assert.match(page, /overview\.period/)
})

test('KAN-645/I3 distinguishes incomplete and unknown planned totals in an accessible textual overview', () => {
  assert.match(page, /incomplete/)
  assert.match(page, /unknown/)
  assert.match(page, /aria-label|<table|<ol/)
  assert.doesNotMatch(page, /getCurrentAthleteRealizedTrainingRangeAction/)
})
