import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'

import { assertAccreditedAcceptanceDatabasePath } from '@/scripts/acceptance-dev-target'

// KAN-885/T1 RED-1: pure, read-only path assertions. Never open or mutate SQLite.
const worktreeRoot = resolve(import.meta.dirname, '../..')
const developerDb = resolve(worktreeRoot, 'sqlite.db')

test('KAN-885/T1 rejects the worktree developer SQLite database', () => {
  assert.throws(
    () => assertAccreditedAcceptanceDatabasePath({
      databasePath: developerDb,
      projectRoot: worktreeRoot,
    }),
    /development|developer|desarrollo|forbidden|prohibited|accredited|acreditad/i,
  )
})

test('KAN-885/T1 rejects a canonical path alias resolving to developer sqlite.db', () => {
  // Path traversal normalization must not bypass the development-database guard.
  const aliasedDeveloperDb = resolve(worktreeRoot, 'nested-directory', '..', 'sqlite.db')
  assert.equal(aliasedDeveloperDb, developerDb)
  assert.throws(
    () => assertAccreditedAcceptanceDatabasePath({
      databasePath: aliasedDeveloperDb,
      projectRoot: worktreeRoot,
    }),
    /development|developer|desarrollo|forbidden|prohibited|accredited|acreditad/i,
  )
})
