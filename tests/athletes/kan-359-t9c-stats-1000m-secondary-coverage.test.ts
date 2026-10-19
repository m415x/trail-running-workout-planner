import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stats = readFileSync('app/[locale]/(mobile)/stats/page.tsx', 'utf8')

test('KAN-823/T9c 1000m panel secondary states use Athlete-scaled roles with unchanged baseline sizes', () => {
  for (const key of ['intro', 'loadError', 'emptyHistory']) {
    assert.match(
      stats,
      new RegExp("text-\\[length:var\\(--athlete-text-body-compact\\)\\][^']*'>\\{t\\('track1000m\\." + key + "'\\)\\}"),
      'missing scalable 0.875rem text for ' + key,
    )
  }
  assert.match(stats, /text-\[length:var\(--athlete-text-caption\)\][^']*'>\{t\('track1000m\.latestTest'\)/)
  assert.match(stats, /text-\[length:var\(--athlete-text-title\)\][^']*'>\{t\('track1000m\.title'\)\}/)
})

test('KAN-823/T9c history entries and summary reference text scale without changing data boundaries', () => {
  assert.match(stats, /rounded-xl border p-3 text-\[length:var\(--athlete-text-body-compact\)\]/)
  assert.match(stats, /gap-3 p-3 text-\[length:var\(--athlete-text-body-compact\)\]/)
  assert.match(stats, /point\.performedAt[^]*text-\[length:var\(--athlete-text-caption\)\]/)
  assert.match(stats, /getCurrentAthleteTrack1000mPerformanceAction/)
  assert.match(stats, /getCurrentAthleteStatsAction/)
  assert.match(stats, /buildAthleteStatsSummaryView/)
})
