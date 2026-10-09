import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const action = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-710 H5B physiology SELF performance read uses its own authenticated capability boundary', () => {
  const start = action.indexOf('export async function getCurrentAthleteTrack1000mPerformanceAction(')
  assert.ok(start >= 0)
  const performanceRead = action.slice(start)
  assert.match(performanceRead, /requireAuthenticatedEptAction/)
  assert.match(performanceRead, /createH5bSelfNextServerContext/)
  assert.match(performanceRead, /physiology\.self\.read/)
  assert.doesNotMatch(performanceRead, /\bgetCurrentAthlete\s*\(/)
})

test('KAN-710 H5B physiology SELF only projects eligible 1000m evidence and derived reference', () => {
  const start = action.indexOf('export async function getCurrentAthleteTrack1000mPerformanceAction(')
  const performanceRead = action.slice(start)
  assert.match(performanceRead, /listEligibleFieldPerformanceTestHistory/)
  assert.match(performanceRead, /projectTrack1000mEvolution/)
  assert.match(performanceRead, /resolveRunningReference/)
  assert.doesNotMatch(performanceRead, /\bphysiologyRecords\b|\bmedical\b|recordedByUserId/)
})
