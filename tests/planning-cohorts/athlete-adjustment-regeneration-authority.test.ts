import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const coachActions = read('app/actions/athlete-session-adjustment-actions.ts')
const dashboardActions = read('app/actions/dashboard-actions.ts')

test('Coach review evaluates stale adjustments instead of hiding non-effective source identities', () => {
  const start = coachActions.indexOf('export async function getSessionAthleteAdjustmentReview')
  const end = coachActions.indexOf('export async function saveAthleteSessionAdjustment', start)
  const review = coachActions.slice(start, end)

  assert.match(review, /resolveEffectiveAthleteAdjustment/)
  assert.match(review, /outside_authority/)
  assert.match(review, /source-prescription-mismatch/)
  assert.match(review, /reviewRequired|requiresReview|authorityStatus/)
})

test('Coach review keeps exact source identity and never rewrites stale adjustments onto the new prescription', () => {
  const start = coachActions.indexOf('export async function getSessionAthleteAdjustmentReview')
  const end = coachActions.indexOf('export async function saveAthleteSessionAdjustment', start)
  const review = coachActions.slice(start, end)

  assert.doesNotMatch(
    review,
    /sourcePrescriptionId\s*:\s*(?:effective|source)Prescription\.id[\s\S]{0,200}adjustment\.id/,
  )
  assert.match(review, /adjustment\.sourcePrescriptionId|sourcePrescriptionId/)
})

test('Athlete loader preserves all current revisions so conflict resolution can detect corruption', () => {
  const start = dashboardActions.indexOf('export async function getCurrentAthletePlanningWeek')
  const end = dashboardActions.indexOf('export async function getAthleteShoes', start)
  const loader = dashboardActions.slice(start, end)

  assert.doesNotMatch(loader, /currentRevisionByAdjustmentId\s*=\s*new Map/)
  assert.match(loader, /filter\([^)]*adjustmentId|revisionsByAdjustmentId|currentRevisions/)
  assert.match(loader, /resolveAthletePlanningSession/)
})

test('regeneration hardening keeps adjustment lifecycle outside generated Session and prescription mutation', () => {
  const regeneration = read('lib/session-generation/session-regeneration.ts')

  assert.doesNotMatch(regeneration, /athleteSessionAdjust/)
  assert.match(regeneration, /existingId/)
  assert.match(regeneration, /action: 'replace'/)
})
