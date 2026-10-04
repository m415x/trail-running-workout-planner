import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-615 does not identify historical physical schema solely by migration head', () => {
  const source = readFileSync(
    'scripts/upgrade-sqlite.ts',
    'utf8',
  )

  const start = source.indexOf(
    'const state = classifyExistingSqlite()',
  )
  const dedicated = source.indexOf(
    'migrateAthleteProfileIdentitySqlite(',
    start,
  )
  const reconciliation = source.indexOf(
    'reconcileVersionedHeadMetadata()',
    dedicated,
  )

  assert.ok(start >= 0, 'Missing state classification')
  assert.ok(dedicated > start, 'Missing dedicated executor')
  assert.ok(
    reconciliation > dedicated,
    'Dedicated executor must precede reconciliation',
  )

  const routing = source.slice(start, reconciliation)

  assert.match(
    routing,
    /table_info\(athlete_profiles\)/,
    'Route must inspect AthleteProfile physical columns',
  )

  assert.match(
    routing,
    /user_id/,
    'Route must distinguish historical user_id constraint',
  )

  assert.doesNotMatch(
    routing,
    /if\s*\(head\?\.created_at\s*===\s*1790802000000\)/,
    'Historical timestamp alone must not control routing',
  )
})
