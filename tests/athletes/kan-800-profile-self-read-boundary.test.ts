import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const boundaryPath = 'lib/athletes/profile-self-read.ts'
const pagePath = 'app/[locale]/(mobile)/profile/page.tsx'

test('KAN-800 Profile has a narrow server-side SELF reader instead of spreading getCurrentAthlete', () => {
  const boundary = readFileSync(boundaryPath, 'utf8')
  const page = readFileSync(pagePath, 'utf8')

  assert.match(boundary, /createH5aSelfNextServerContext|createH5bSelfNextServerContext/)
  assert.match(boundary, /requireAuthenticatedEptAction/)
  assert.match(page, /profile-self-read|ProfileSelf|readCurrentAthleteProfile/)
  assert.doesNotMatch(page, /getCurrentAthlete\(/)
})

test('KAN-800 SELF boundary uses server-resolved profile and active Team, never client identity locators', () => {
  const boundary = readFileSync(boundaryPath, 'utf8')
  assert.match(boundary, /athleteProfileId/)
  assert.match(boundary, /teamId/)
  assert.match(boundary, /isActive/)
  assert.match(boundary, /isDeleted/)
  assert.doesNotMatch(boundary, /formData\.get\(['"](?:athleteId|teamId|userId)/)
})

test('KAN-800 reader does not include raw physiology, medical or identity fields in client projection', () => {
  const boundary = readFileSync(boundaryPath, 'utf8')
  assert.doesNotMatch(boundary, /columns:\s*\{[^}]*\b(?:dni|medical|physiology|contactEmail|emergencyPhone|birthday|userId):\s*true/)
  assert.doesNotMatch(boundary, /\.select\(\)/)
})
