import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-615 routes versioned 0015 through the dedicated executor before generic reconciliation', () => {
  const source = readFileSync(
    'scripts/upgrade-sqlite.ts',
    'utf8',
  )

  const classification = source.indexOf(
    'const state = classifyExistingSqlite()',
  )

  const dedicated = source.indexOf(
    'migrateAthleteProfileIdentitySqlite(',
  )

  const reconciliation = source.indexOf(
    "state === 'versioned' && reconcileVersionedHeadMetadata()",
  )

  const genericMigrate = source.lastIndexOf(
    "runDrizzleKit([",
  )

  assert.ok(classification >= 0, 'Missing classification')
  assert.ok(dedicated >= 0, 'Missing dedicated KAN-615 route')
  assert.ok(reconciliation >= 0, 'Missing existing reconciliation')
  assert.ok(genericMigrate >= 0, 'Missing generic migration route')

  assert.ok(
    classification < dedicated &&
    dedicated < reconciliation &&
    reconciliation < genericMigrate,
    'Dedicated KAN-615 handling must precede metadata reconciliation and generic migration',
  )
})
