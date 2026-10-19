import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646 Block A SQLite server writer derives the Team IANA timezone from persisted authorized SELF scope', () => {
  const source = readFileSync('lib/physiology/biometric-self-sqlite-server-writer.ts', 'utf8')
  assert.doesNotMatch(source, /serverContext\s*:\s*\{\s*readonly timeZone/)
  assert.match(source, /resolveBiometricSelfAuthority\('manage'\)/)
  assert.match(source, /SELECT time_zone FROM teams/)
  assert.match(source, /subject\.teamId/)
  assert.match(source, /resolveBiometricCivilToday/)
})
