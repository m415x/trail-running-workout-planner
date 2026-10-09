import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const statsPage = readFileSync('app/[locale]/(mobile)/stats/page.tsx', 'utf8')
const fieldActions = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-713 H5B read UI must not expose the legacy 1000m evidence registration form', () => {
  assert.doesNotMatch(statsPage, /AthleteTrack1000mForm/)
  assert.doesNotMatch(statsPage, /getCurrentAthleteTrack1000mTestEventsAction/)
  assert.doesNotMatch(statsPage, /track1000m\.register/)
})

test('KAN-713 H5B read capability does not authorize legacy writes', () => {
  const begin = fieldActions.indexOf('export async function getCurrentAthleteTrack1000mEvidenceAction(')
  const end = fieldActions.indexOf('export async function createCoachTrack1000mEvidenceAction(', begin)
  assert.ok(begin >= 0 && end > begin)
  const write = fieldActions.slice(begin, end)
  assert.doesNotMatch(write, /physiology\.self\.read|stats\.self\.read|createH5bSelfNextServerContext/)
  assert.match(write, /createAthleteTrack1000mEvidence/)
})
