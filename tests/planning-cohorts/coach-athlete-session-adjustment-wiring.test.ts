import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'athlete-session-adjustment-actions.ts'),
  'utf8',
)

test('Coach review resolves each athlete through dated planning authority before exposing a source prescription', () => {
  const start = source.indexOf('export async function getSessionAthleteAdjustmentReview')
  const end = source.indexOf('export async function saveAthleteSessionAdjustment', start)
  const review = source.slice(start, end)

  assert.match(review, /getSessionById|getSession/)
  assert.match(review, /athleteProfiles/)
  assert.match(review, /resolveAthletePlanningOnDate/)
  assert.match(review, /resolveAthleteSessionPrescription/)
  assert.match(review, /sourcePrescriptionId/)
  assert.doesNotMatch(
    review,
    /Promise<SessionAthleteAdjustmentReviewItem\[\]>\s*\{\s*return \[\]\s*\}/,
  )

  const planningIndex = review.indexOf('resolveAthletePlanningOnDate')
  const prescriptionIndex = review.indexOf('resolveAthleteSessionPrescription')
  assert.ok(planningIndex >= 0)
  assert.ok(prescriptionIndex > planningIndex)
})

test('Coach review loads the current exact-source adjustment and current revision', () => {
  const start = source.indexOf('export async function getSessionAthleteAdjustmentReview')
  const end = source.indexOf('export async function saveAthleteSessionAdjustment', start)
  const review = source.slice(start, end)

  assert.match(review, /athleteSessionAdjustments/)
  assert.match(review, /athleteSessionAdjustmentRevisions/)
  assert.match(review, /sourcePrescriptionId/)
  assert.match(review, /isCurrent/)
})

test('Coach save writes through the append-only adjustment persistence adapter', () => {
  const start = source.indexOf('export async function saveAthleteSessionAdjustment')
  const save = source.slice(start)

  assert.match(save, /createDrizzleAthleteSessionAdjustmentDatabase/)
  assert.match(save, /createAthleteSessionAdjustmentPersistenceAdapter/)
  assert.match(save, /getAdjustmentByIdentity/)
  assert.match(save, /persistence\.applyRevision\(/)
  assert.doesNotMatch(save, /applyAthleteDoseAdjustment\(/)
  assert.doesNotMatch(save, /applyAthleteAssignmentAdjustment\(/)
})

test('Coach save preserves logical identity when editing an existing adjustment', () => {
  const start = source.indexOf('export async function saveAthleteSessionAdjustment')
  const save = source.slice(start)

  assert.match(save, /existingAdjustment/)
  assert.match(save, /existingAdjustment\.id/)
  assert.match(save, /randomUUID\(\)/)
  assert.match(save, /sourcePrescriptionId/)
})
