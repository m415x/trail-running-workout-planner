import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const boundary = readFileSync('lib/authorization/h5a-self-context.ts', 'utf8')
const server = readFileSync('lib/authorization/h5a-self-next-server.ts', 'utf8')

test('KAN-646/T5 H5A context explicitly allows only biometric SELF read/manage beyond existing SELF capabilities', () => {
  assert.match(boundary, /'physiology\.biometric\.self\.read'/)
  assert.match(boundary, /'physiology\.biometric\.self\.manage'/)
  assert.match(boundary, /'planning\.self\.read'/)
  assert.match(boundary, /'workout_log\.self\.manage'/)
  assert.match(boundary, /authorizeEffectiveCapability/)
  assert.match(boundary, /requiredScope:\s*'self'/)
})

test('KAN-646/T5 SELF resolution keeps server-owned active Team and unique linked athlete profile', () => {
  assert.match(boundary, /resolveActiveTeam\(access\.userId\)/)
  assert.match(boundary, /resolveSelfAthleteProfile\(profiles/)
  assert.match(boundary, /if \(!athleteProfileId\) return \{ status: 'denied' \}/)
  assert.match(boundary, /grants:\s*\[\]/)
  assert.match(server, /createActiveTeamNextServerContext/)
  assert.match(server, /createH4aNextServerEvidenceSource/)
})
