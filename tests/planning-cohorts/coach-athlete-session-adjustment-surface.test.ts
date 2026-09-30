import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

const detail = read('app/[locale]/dashboard/sessions/[sessionId]/page.tsx')

test('Coach session detail exposes a separate individual-adjustment review surface', () => {
  assert.match(detail, /getSessionAthleteAdjustmentReview/)
  assert.match(detail, /AthleteSessionAdjustmentReview/)
  assert.doesNotMatch(detail, /import\s*\{?\s*SessionForm|<SessionForm\b/)
})

test('individual review is loaded from the Session detail, not folded into shared Session editing', () => {
  const reviewLoad = detail.indexOf('getSessionAthleteAdjustmentReview')
  const sharedLoad = detail.indexOf('getSessionById')

  assert.ok(sharedLoad >= 0)
  assert.ok(reviewLoad >= 0)
  assert.notEqual(reviewLoad, sharedLoad)
})

test('Coach adjustment surface has its own server-action boundary', () => {
  const actions = read('app/actions/athlete-session-adjustment-actions.ts')
  const component = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')

  assert.match(actions, /getSessionAthleteAdjustmentReview/)
  assert.match(actions, /saveAthleteSessionAdjustment/)
  assert.match(component, /saveAthleteSessionAdjustment/)
  assert.doesNotMatch(actions, /updateSession\(/)
  assert.doesNotMatch(component, /SessionForm/)
})

test('Coach individual editor stays within the frozen adjustment fields', () => {
  const component = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')

  for (const allowed of [
    'distanceKm',
    'durationMin',
    'elevationGain',
    'intensity',
    'assignmentMode',
    'rescheduled',
    'stimulus',
    'omitted',
  ]) {
    assert.match(component, new RegExp(allowed))
  }

  for (const forbidden of [
    'locationKey',
    'trackPath',
    'preliminaryExercises',
    'warmup',
    'mainBlock',
    'cooldown',
  ]) {
    assert.equal(component.includes(forbidden), false, forbidden)
  }
})
