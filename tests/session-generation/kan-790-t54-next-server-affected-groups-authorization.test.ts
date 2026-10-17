import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const file = 'lib/session-generation/authorized-review-snapshot-affected-groups-next-server.ts'

test('KAN-790 T5.4 H4A authorizes every preexisting and resulting Sporting Group before CONFIRM writes', () => {
  const source = readFileSync(file, 'utf8')
  assert.match(source, /export async function authorizeReviewSnapshotAffectedGroupsNextServer\s*\(/)
  assert.match(source, /requireAuthenticatedEptAction/)
  assert.match(source, /createActiveTeamNextServerContext/)
  assert.match(source, /createH4aNextServerAuthorizationBoundary/)
  assert.match(source, /capability:\s*'planning\.manage'/)
  assert.match(source, /groupSessionPrescriptions/)
  assert.match(source, /sessions\.sharedEventKey/)
  assert.match(source, /groupTrainingPlans\.groupId/)
  assert.match(source, /proposal\.events/)
  assert.match(source, /authorization\.authorize\(/)
  assert.match(source, /return null|kind:\s*'denied'/)
  assert.doesNotMatch(source, /CURRENT_TEAM_ID|FormData|formData\.get\(/)
})

test('KAN-790 T5.4 H4A group authority reads trusted persisted snapshot rather than client proposal', () => {
  const source = readFileSync(file, 'utf8')
  assert.match(source, /getActiveReviewSnapshotSqlite|readReviewSnapshotSqlite|sessionGenerationReviewSnapshots/)
  assert.match(source, /snapshot\.proposal/)
  assert.match(source, /snapshot\.userId/)
  assert.match(source, /snapshot\.teamId/)
  assert.match(source, /snapshot\.groupTrainingPlanId/)
  assert.match(source, /snapshot\.planningCohortId/)
  assert.match(source, /authorizeReviewSnapshotNextServer/)
})
