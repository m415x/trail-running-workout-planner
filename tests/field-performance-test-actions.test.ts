import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actionPath = path.join(process.cwd(), 'app/actions/field-performance-test-actions.ts')

test('server action composes team-scoped athlete authorization with the durable repository', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getAthleteById/)
  assert.match(source, /createSqliteFieldPerformanceTestRepository/)
  assert.match(source, /createTrack1000mEvidence/)
  assert.match(source, /correctTrack1000mEvidence/)
})

test('server action does not mutate legacy physiology or planning snapshots', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.doesNotMatch(source, /physiologyRecords/)
  assert.doesNotMatch(source, /athleteProfiles\.physiology/)
  assert.doesNotMatch(source, /groupTrainingPlans/)
  assert.doesNotMatch(source, /sessions/)
})


test('server action exposes separate athlete and coach field-test workflows', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCurrentAthlete/)
  assert.match(source, /createAthleteTrack1000mEvidence/)
  assert.match(source, /createCoachTrack1000mEvidence/)
  assert.match(source, /reviewCoachTrack1000mEvidence/)
  assert.match(source, /repository\.review/)
})

test('athlete field-test action derives subject identity server-side', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCurrentAthleteTrack1000mEvidenceAction/)
  assert.match(source, /getCurrentAthlete\(\)/)
  const signature = source.match(/getCurrentAthleteTrack1000mEvidenceAction\s*\(([\s\S]*?)\)\s*\{/)
  assert.ok(signature)
  assert.doesNotMatch(signature[1] ?? '', /\buserId\s*:/)
  assert.doesNotMatch(signature[1] ?? '', /\bathleteId\s*:/)
})


test('athlete field-test workflow exposes eligible official TestEvents for the current subject', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCurrentAthleteTrack1000mTestEventsAction/)
  assert.match(source, /fieldPerformanceTestEvents/)
  assert.match(source, /const athlete = currentAthlete\.data\.athleteProfile/)
  assert.match(source, /fieldPerformanceTestEvents\.teamId, athlete\.teamId/)
  assert.match(source, /fieldPerformanceTestEvents\.groupId, groupId/)
  assert.match(source, /fieldPerformanceTestEvents\.teamId/)
  assert.match(source, /fieldPerformanceTestEvents\.groupId/)
  assert.match(source, /fieldPerformanceTestEvents\.isDeleted/)
})


test('coach field-test workflow derives recorder identity server-side', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  const signature = source.match(/createCoachTrack1000mEvidenceAction\s*\(([\s\S]*?)\)\s*\{/)
  assert.ok(signature)
  assert.doesNotMatch(signature[1] ?? '', /\bcoachUserId\s*:/)
  assert.match(source, /getCurrentCoachUserId/)
  assert.match(source, /coachUserId: currentCoachUserId/)
})
