import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSelfSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-repository'

test('KAN-646/T5 repository cannot be constructed without transaction-local SELF reauthorization', () => {
  const sqlite = new Database(':memory:')
  try {
    assert.throws(
      () => createBiometricSelfSqliteRepository(sqlite),
      /reauthoriz/i,
    )
    assert.throws(
      // @ts-expect-error Intentional invalid options: runtime must also reject missing reauthorization.
      () => createBiometricSelfSqliteRepository(sqlite, {}),
      /reauthoriz/i,
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-646/T5 repository accepts explicit transaction-local authority callback', () => {
  const sqlite = new Database(':memory:')
  try {
    const repository = createBiometricSelfSqliteRepository(sqlite, {
      reauthorizeInTransaction: () => false,
    })
    assert.equal(typeof repository.create, 'function')
    assert.equal(typeof repository.correct, 'function')
  } finally {
    sqlite.close()
  }
})
