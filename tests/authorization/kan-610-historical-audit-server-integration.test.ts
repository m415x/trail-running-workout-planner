import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-733 Coach audit action delegates through existing H4A authorized athlete resolver', () => {
  const action = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const start = action.indexOf('export async function getCoachTrack1000mAuditHistoryAction(')
  assert.ok(start >= 0, 'server action must expose audited Coach history')
  const end = action.indexOf('\nexport async function ', start + 1)
  const body = action.slice(start, end === -1 ? undefined : end)
  assert.ok(body.includes('readAuthorizedFieldPerformanceTestAuditHistory('))
  assert.ok(body.includes("resolveAuthorizedCoachPhysiologyAthlete(athleteId, 'physiology.read')"), 'resolve H2/H3 Coach authority before history')
  assert.ok(body.includes('resolveOwnedAthlete: async (id: string) => id === athlete.id'), 'scope historical reader to authorized athlete')
  assert.ok(body.includes('repository.listAllByAthlete'), 'history must include invalidated evidence')
  assert.ok(!body.includes('repository.listAllByAthlete(athleteId)'), 'no direct unguarded read')
})

test('KAN-733 historical repository includes inactive revisions by athlete', () => {
  const source = readFileSync('lib/physiology/field-performance-test-sqlite.ts', 'utf8')
  assert.ok(source.includes('listAllByAthlete(athleteId)'))
  const start = source.indexOf('    listAllByAthlete(athleteId)')
  const end = source.indexOf('\n    },', start)
  const body = source.slice(start, end)
  assert.ok(body.includes('eq(fieldPerformanceTests.athleteId, athleteId)'))
  assert.ok(!body.includes('eq(fieldPerformanceTests.isDeleted, false)'), 'audit must retain invalidated rows')
})
