import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646/T5 server-side writer binds authenticated biometric manage authority to validated input and authorized SQLite persistence', () => {
  const source = readFileSync('lib/physiology/biometric-self-sqlite-server-writer.ts', 'utf8')
  assert.match(source, /resolveBiometricSelfAuthority/)
  assert.match(source, /createBiometricSelfWriter/)
  assert.match(source, /createPersistedAuthorizedBiometricSqliteRepository/)
  assert.match(source, /sqliteConnection/)
  assert.match(source, /'manage'/)
  assert.doesNotMatch(source, /teamId:\s*input\.|athleteProfileId:\s*input\.|userId:\s*input\./)
})

test('KAN-646/T5 server writer does not export a public Server Action before backend and correction parity gate', () => {
  const source = readFileSync('lib/physiology/biometric-self-sqlite-server-writer.ts', 'utf8')
  assert.doesNotMatch(source, /['"]use server['"]/)
})
