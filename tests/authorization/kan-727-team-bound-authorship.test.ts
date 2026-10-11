import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAuthorizedH7aWriterContext } from '@/lib/authorization/h7a-trusted-authorship'

test('KAN-727 author context only exists with H2 and authorized active Team', () => {
  const actor = { status: 'authenticated' as const, userId: 'coach_a' }
  const authorized = resolveAuthorizedH7aWriterContext(actor, { allowed: true, teamId: 'team_a' })
  assert.deepEqual(authorized, {
    teamId: 'team_a',
    authorship: { authenticatedActorUserId: 'coach_a', effectiveActorUserId: 'coach_a' },
  })
  assert.equal(resolveAuthorizedH7aWriterContext(actor, { allowed: false, teamId: 'team_a' }), null)
  assert.equal(resolveAuthorizedH7aWriterContext(actor, { allowed: true }), null)
  assert.equal(resolveAuthorizedH7aWriterContext({ status: 'forbidden', reason: 'unlinked' }, { allowed: true, teamId: 'team_a' }), null)
})

test('KAN-727 active Team decides scope; caller-supplied team or actor cannot override H2/H3', () => {
  const actor = { status: 'authenticated' as const, userId: 'coach_a', effectiveActorUserId: 'spoofed', teamId: 'team_b' }
  assert.deepEqual(resolveAuthorizedH7aWriterContext(actor, { allowed: true, teamId: 'team_a' }), {
    teamId: 'team_a',
    authorship: { authenticatedActorUserId: 'coach_a', effectiveActorUserId: 'coach_a' },
  })
})
