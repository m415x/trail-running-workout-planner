import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('coach visible 1000m history excludes rejected evidence', () => {
  const source = readFileSync('app/actions/field-performance-test-actions.ts', 'utf8')
  const start = source.indexOf('export async function getCoachTrack1000mHistoryAction')
  const end = source.indexOf('export async function getCurrentAthleteTrack1000mPerformanceAction', start)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  const action = source.slice(start, end)
  assert.match(
    action,
    /const history = repository[\s\S]*?\.listActiveByAthlete\(athleteId\)[\s\S]*?\.filter\([\s\S]*?reviewStatus[\s\S]*?!== 'rejected'/,
  )
})
