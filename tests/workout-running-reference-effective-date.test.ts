import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('mobile workout guidance resolves running reference for the selected workout date', async () => {
  const homeSource = await readFile('features/workouts/HomeTab.tsx', 'utf8')
  const pageSource = await readFile('app/[locale]/(mobile)/page.tsx', 'utf8')

  assert.match(homeSource, /selectedWeekDay[?][.]fullDate/)
  assert.match(homeSource, /getCurrentAthleteTrack1000mPerformanceAction/)
  assert.doesNotMatch(pageSource, /getCurrentAthleteTrack1000mPerformanceAction[(]range[.]endDate[)]/)
})

test('week navigation does not keep a stale initial running reference', async () => {
  const homeSource = await readFile('features/workouts/HomeTab.tsx', 'utf8')

  assert.match(homeSource, /runningReference/)
  assert.match(homeSource, /setRunningReference/)
})
