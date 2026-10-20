import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stats = readFileSync('app/[locale]/(mobile)/stats/page.tsx', 'utf8')

test('KAN-824/T9d Stats status and competition metadata use scalable Athlete roles', () => {
  assert.match(stats, /text-\[length:var\(--athlete-text-body-compact\)\][^']*'>\{t\('summary\.error'\)\}/)
  assert.equal(
    (stats.match(/text-\[length:var\(--athlete-text-body\)\] font-semibold text-muted-foreground'>\{t\('insufficientData'\)\}/g) ?? []).length,
    2,
    'load and adherence empty states retain 1rem standard base',
  )
  assert.match(stats, /text-\[length:var\(--athlete-text-body-compact\)\][^']*'>\{t\('competitionDetail\.noPrimary'\)\}/)
  assert.match(stats, /text-\[length:var\(--athlete-text-body-compact\)\][^']*'>.*\{view\.competition\.date\}/)
})

test('KAN-824/T9d preserves primary metric hierarchy and Stats queries', () => {
  assert.match(stats, /text-2xl font-bold'>\{view\.load\.value\}/)
  assert.match(stats, /text-2xl font-bold'>\{view\.adherence\.value\}/)
  assert.match(stats, /text-xl font-bold'>\{view\.competition\.name\}/)
  assert.match(stats, /getCurrentAthleteStatsAction/)
  assert.match(stats, /getCurrentAthleteTrack1000mPerformanceAction/)
})
