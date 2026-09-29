import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const actions = read('app/actions/athlete-session-adjustment-actions.ts')
const component = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')

test('Coach stale adjustments are visibly review-required and not editable as ordinary effective adjustments', () => {
  assert.match(component, /reviewRequired|authorityStatus/)
  assert.match(component, /outside_authority|review/i)
  assert.match(component, /disabled=.*reviewRequired|reviewRequired.*disabled/)
})

test('Coach save re-resolves dated planning authority before accepting the submitted source prescription', () => {
  const start = actions.indexOf('export async function saveAthleteSessionAdjustment')
  const end = actions.indexOf('function parseDoseOverrides', start)
  const save = actions.slice(start, end)

  assert.match(save, /resolveAthletePlanningOnDate/)
  assert.match(save, /resolveAthleteSessionPrescription/)
  assert.match(save, /source-prescription-mismatch|staleSourcePrescription/)
  assert.match(save, /sourcePrescriptionId/)
})

test('Coach save requires a non-empty audit reason', () => {
  const start = actions.indexOf('export async function saveAthleteSessionAdjustment')
  const end = actions.indexOf('function parseDoseOverrides', start)
  const save = actions.slice(start, end)

  assert.match(save, /reason\.trim\(\)|\.trim\(\).*reason/)
  assert.match(save, /invalidReason|reasonRequired/)
})
