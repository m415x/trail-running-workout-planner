import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adapter = readFileSync('lib/session-generation/authorized-review-snapshot-next-server.ts', 'utf8')

test('KAN-790 T5.1 production adapter composes H2 EPT, active H3 Team, and H4A planning.manage', () => {
  assert.match(adapter, /requireAuthenticatedEptAction/)
  assert.match(adapter, /readEptSessionAccessState/)
  assert.match(adapter, /createActiveTeamNextServerContext/)
  assert.match(adapter, /createH4aNextServerAuthorizationBoundary/)
  assert.match(adapter, /capability:\s*'planning\.manage'/)
  assert.match(adapter, /resolveAuthorizedReviewSnapshotScope/)
})

test('KAN-790 T5.1 production adapter resolves Plan to Group and real Team before permission check', () => {
  assert.match(adapter, /groupTrainingPlans\.groupId/)
  assert.match(adapter, /athleteGroups\.teamId/)
  assert.match(adapter, /groupTrainingPlans\.planningCohortId/)
  assert.match(adapter, /eq\(groupTrainingPlans\.isDeleted, false\)/)
  assert.match(adapter, /eq\(athleteGroups\.isDeleted, false\)/)
  assert.doesNotMatch(adapter, /CURRENT_TEAM_ID/)
})
