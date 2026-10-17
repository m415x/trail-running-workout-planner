import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646/T8 public biometric actions delegate exclusively to authenticated SELF SQLite writers', () => {
  const action = readFileSync('app/actions/biometric-self-actions.ts', 'utf8')
  const writer = readFileSync('lib/physiology/biometric-self-sqlite-server-writer.ts', 'utf8')
  const authority = readFileSync('lib/physiology/biometric-self-next-server.ts', 'utf8')

  assert.match(action, /^'use server'/)
  assert.match(action, /export async function createCurrentSelfBiometricAction\(input: BiometricCreateInput\)/)
  assert.match(action, /export async function correctCurrentSelfBiometricAction\(input: BiometricCorrectionInput\)/)
  assert.match(action, /createCurrentBiometricSqliteObservation\(input\)/)
  assert.match(action, /correctCurrentBiometricSqliteObservation\(input\)/)
  assert.doesNotMatch(action, /athleteProfileId\s*:|teamId\s*:|userId\s*:/)

  assert.match(writer, /resolveBiometricSelfAuthority\('manage'\)/)
  assert.match(writer, /createPersistedAuthorizedBiometricSqliteRepository/)
  assert.match(writer, /repository\.create\(subject, validated\)/)
  assert.match(writer, /repository\.correct\(subject, validated\)/)
  assert.doesNotMatch(writer, /(?:userId|teamId|athleteProfileId)\s*:\s*input\./)

  assert.match(authority, /readEptSessionAccessState\(supabase\.auth, lookup\)/)
  assert.match(authority, /requireAuthenticatedEptAction/)
  assert.match(authority, /createH5aSelfNextServerContext\(\)\.resolve\(access/)
  assert.doesNotMatch(authority, /(?:userId|teamId|athleteProfileId)\s*:\s*input\./)
})
