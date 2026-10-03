import assert from 'node:assert/strict'
import test from 'node:test'

import { requireSpecificLocalMigrationApproval } from '../../lib/sandbox/local-migration-approval'

const pin = '1234567890123456789'
const approved = {
  operation: 'migrate' as const,
  approvedByOperator: true as const,
  approvedClusterSystemIdentifier: pin,
}

test('KAN-598 requires distinct migration approval in addition to the local cluster pin', () => {
  for (const approval of [undefined, null, {
    operation: 'seed', approvedByOperator: true, approvedClusterSystemIdentifier: pin,
  }, {
    operation: 'migrate', approvedByOperator: false, approvedClusterSystemIdentifier: pin,
  }]) {
    assert.throws(() => requireSpecificLocalMigrationApproval({
      expectedClusterSystemIdentifier: pin,
      approval,
    }), /approval|migrat|confirm/i)
  }
})

test('KAN-598 refuses approval for another physical PostgreSQL cluster', () => {
  assert.throws(() => requireSpecificLocalMigrationApproval({
    expectedClusterSystemIdentifier: pin,
    approval: { ...approved, approvedClusterSystemIdentifier: '9876543210987654321' },
  }), /approval|cluster|pin/i)
})

test('KAN-598 accepts matching explicit approval solely as a precondition, not as proof of database identity', () => {
  assert.doesNotThrow(() => requireSpecificLocalMigrationApproval({
    expectedClusterSystemIdentifier: pin,
    approval: approved,
  }))
})

test('KAN-598 rejects unknown approval fields rather than accidentally accepting stale or generic tokens', () => {
  assert.throws(() => requireSpecificLocalMigrationApproval({
    expectedClusterSystemIdentifier: pin,
    approval: { ...approved, resetAllowed: true },
  }), /approval|field|invalid/i)
})
