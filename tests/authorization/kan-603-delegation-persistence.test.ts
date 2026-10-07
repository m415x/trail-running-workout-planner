import assert from 'node:assert/strict'
import test from 'node:test'

import { getTableColumns, getTableName } from 'drizzle-orm'

import { authorizationGrants } from '../../db/schema'
import {
  isAuthorizationGrantActive,
  type AuthorizationGrantRecord,
} from '../../lib/authorization/grant-lifecycle'

test('KAN-657 persists the bounded H3 grant lifecycle fields', () => {
  assert.equal(getTableName(authorizationGrants), 'authorization_grants')

  const columns = getTableColumns(authorizationGrants)

  for (const column of [
    'id',
    'beneficiaryUserId',
    'teamId',
    'capability',
    'scope',
    'scopeTargetId',
    'effectiveFrom',
    'effectiveUntil',
    'grantedByUserId',
    'reason',
    'revokedAt',
    'revokedByUserId',
    'revocationReason',
  ] as const) {
    assert.ok(columns[column], `missing grant column: ${column}`)
  }

  assert.equal('actorSnapshot' in columns, false)
  assert.equal('auditPayload' in columns, false)
  assert.equal('rlsPolicy' in columns, false)
  assert.equal(columns.effectiveUntil.notNull, true)
})

const activeGrant = (
  overrides: Partial<AuthorizationGrantRecord> = {},
): AuthorizationGrantRecord => ({
  id: 'grant-1',
  beneficiaryUserId: 'user-beneficiary',
  teamId: 'team-a',
  capability: 'training.coordinate',
  scope: 'sporting_group',
  scopeTargetId: 'group-a',
  effectiveFrom: '2026-10-07T10:00:00.000Z',
  effectiveUntil: '2026-10-07T12:00:00.000Z',
  grantedByUserId: 'user-grantor',
  reason: 'Temporary interval coordination',
  revokedAt: null,
  revokedByUserId: null,
  revocationReason: null,
  ...overrides,
})

test('KAN-657 authorizes only inside the explicit half-open validity window', () => {
  assert.equal(
    isAuthorizationGrantActive(
      activeGrant(),
      '2026-10-07T10:00:00.000Z',
    ),
    true,
  )
  assert.equal(
    isAuthorizationGrantActive(
      activeGrant(),
      '2026-10-07T11:59:59.999Z',
    ),
    true,
  )
  assert.equal(
    isAuthorizationGrantActive(
      activeGrant(),
      '2026-10-07T12:00:00.000Z',
    ),
    false,
  )
})

test('KAN-657 revoked grants fail closed without destroying grant history', () => {
  const revoked = activeGrant({
    revokedAt: '2026-10-07T10:30:00.000Z',
    revokedByUserId: 'user-admin',
    revocationReason: 'Coverage ended early',
  })

  assert.equal(
    isAuthorizationGrantActive(
      revoked,
      '2026-10-07T10:29:59.999Z',
    ),
    true,
  )
  assert.equal(
    isAuthorizationGrantActive(
      revoked,
      '2026-10-07T10:30:00.000Z',
    ),
    false,
  )

  assert.equal(revoked.id, 'grant-1')
  assert.equal(revoked.reason, 'Temporary interval coordination')
})

test('KAN-657 rejects invalid lifecycle records', () => {
  assert.throws(
    () => isAuthorizationGrantActive(
      activeGrant({
        effectiveUntil: '2026-10-07T10:00:00.000Z',
      }),
      '2026-10-07T10:00:00.000Z',
    ),
    /Invalid authorization grant validity/,
  )

  assert.throws(
    () => isAuthorizationGrantActive(
      activeGrant({
        revokedAt: '2026-10-07T09:59:59.999Z',
      }),
      '2026-10-07T10:00:00.000Z',
    ),
    /Invalid authorization grant revocation/,
  )
})

test('KAN-657 keeps reserved ASSIGNED_ATHLETES out of persisted executable grants', () => {
  assert.throws(
    () => isAuthorizationGrantActive(
      activeGrant({
        scope: 'assigned_athletes',
        scopeTargetId: 'athlete-a',
      }),
      '2026-10-07T11:00:00.000Z',
    ),
    /Reserved authorization scope/,
  )
})
