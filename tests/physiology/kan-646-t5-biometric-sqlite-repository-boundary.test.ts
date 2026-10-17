import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646/T5 SQLite repository uses a transaction and server-resolved SELF subject', () => {
  const source = readFileSync('lib/physiology/biometric-self-sqlite-repository.ts', 'utf8')
  assert.match(source, /athleteBiometricObservations/)
  assert.match(source, /transaction\(/)
  assert.match(source, /teamId/)
  assert.match(source, /athleteProfileId/)
  assert.match(source, /recordedByUserId/)
  assert.match(source, /operationKey/)
  assert.match(source, /requestDigest/)
  assert.match(source, /supersedesObservationId/)
  assert.doesNotMatch(source, /from ['"]@\/db['"]/)
})

test('KAN-646/T5 SQLite runtime registers only the isolated biometric table schema', () => {
  const source = readFileSync('db/index.ts', 'utf8')
  assert.match(source, /athlete-biometric-observation-schema/)
  assert.match(source, /biometricObservationSchema/)
})
