import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646/T5 internal server correction uses H2/H3 SELF guard and transactionally authorized SQLite repository', () => {
  const source = readFileSync('lib/physiology/biometric-self-sqlite-server-writer.ts', 'utf8')
  assert.match(source, /correctCurrentBiometricSqliteObservation/)
  assert.match(source, /BiometricCorrectionInput/)
  assert.match(source, /resolveBiometricSelfAuthority\('manage'\)/)
  assert.match(source, /createPersistedAuthorizedBiometricSqliteRepository/)
  assert.match(source, /correct:\s*async\s*\(subject,\s*validated\)\s*=>\s*repository\.correct\(subject,\s*validated\)/)
  assert.match(source, /writer\.correct\(input\)/)
  assert.doesNotMatch(source, /['"]use server['"]/)
  assert.doesNotMatch(source, /teamId:\s*input\.|athleteProfileId:\s*input\.|userId:\s*input\./)
})
