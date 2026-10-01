import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('features/workouts/HomeTab.tsx', 'utf8')
const plan = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
const profile = readFileSync('features/profile/ProfileTab.tsx', 'utf8')

test('KAN-563 aligns Athlete Home Plan and Profile with the Stats content width', () => {
  for (const source of [home, plan, profile]) {
    assert.match(source, /mx-auto/)
    assert.match(source, /w-full/)
    assert.match(source, /max-w-5xl/)
  }
})

test('KAN-563 gives Athlete Home a wide two-column calendar and workout-detail composition', () => {
  assert.match(home, /grid[^'"]*gap-2[^'"]*lg:grid-cols-2/)
  assert.match(
    home,
    /<WeeklyCalendarCard[\s\S]*<div className=['"]space-y-2['"]>[\s\S]*currentWorkouts/,
  )
})
