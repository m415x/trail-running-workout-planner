import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-606 T4 Coach historical audit uses physiology.read before repository access', () => {
  const start = source.indexOf('export async function getCoachTrack1000mAuditHistoryAction(')
  const end = source.indexOf('export async function getCoachTrack1000mHistoryAction(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  assert.ok(action.includes("'physiology.read'"), 'Historical audit must require H3 read capability')
  assert.ok(action.includes('not_authorized'), 'DENY must not become empty successful history')
  assert.ok(action.indexOf("'physiology.read'") < action.indexOf('readAuthorizedFieldPerformanceTestAuditHistory('), 'Authorize before audit repository boundary')
})
