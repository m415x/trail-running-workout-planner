import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')

test('KAN-606 T4 Coach evidence reads require H3 physiology.read authorization', () => {
  const names = [
    'getCoachTrack1000mTestEventsAction',
    'getCoachPendingTrack1000mEvidenceAction',
    'getCoachTrack1000mHistoryAction',
  ]
  for (const name of names) {
    const start = source.indexOf(`export async function ${name}(`)
    assert.ok(start >= 0, `${name} exists`)
    const end = source.indexOf('\nexport async function ', start + 1)
    const action = source.slice(start, end < 0 ? undefined : end)
    assert.ok(action.includes("'physiology.read'"), `${name} requires explicit physiology.read authorization`)
    assert.ok(action.includes('not_authorized'), `${name} must fail closed`)
  }
})
