import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646/T5 biometric Next server boundary must reauthenticate and resolve SELF per operation', () => {
  const source = readFileSync('lib/physiology/biometric-self-next-server.ts', 'utf8')
  assert.match(source, /requireAuthenticatedEptAction/)
  assert.match(source, /readEptSessionAccessState/)
  assert.match(source, /createH5aSelfNextServerContext/)
  assert.match(source, /physiology\.biometric\.self\.(read|manage)/)
  assert.match(source, /resolve\(access/)
  assert.doesNotMatch(source, /athleteProfileId:\s*input\.|teamId:\s*input\.|userId:\s*input\./)
})

test('KAN-646/T5 biometric authorization boundary cannot use legacy H5B physiology read permission', () => {
  const source = readFileSync('lib/physiology/biometric-self-next-server.ts', 'utf8')
  assert.doesNotMatch(source, /['"]physiology\.self\.read['"]/)
  assert.doesNotMatch(source, /['"]planning\.self\.read['"]/)
})
