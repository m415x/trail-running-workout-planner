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


test('KAN-563 aligns Athlete page spacing and primary heading scale with Stats', () => {
  assert.match(home, /px-4[^'"]*py-6[^'"]*sm:px-6/)
  assert.match(plan, /px-4[^'"]*py-6[^'"]*sm:px-6/)
  assert.match(profile, /px-4[^'"]*py-6[^'"]*sm:px-6/)

  assert.match(home, /text-2xl[^'"]*sm:text-3xl/)
  assert.match(plan, /text-2xl[^'"]*sm:text-3xl/)
  assert.match(profile, /text-2xl[^'"]*sm:text-3xl/)
})

test('KAN-563 keeps Athlete Home identity and calendar fixed while workout detail scrolls', () => {
  assert.match(home, /<header[^>]*>/)
  assert.match(home, /sticky[^'"]*top-0/)
  assert.match(home, /<WeeklyCalendarCard/)
  assert.match(home, /<section[^>]*>/)
  assert.match(home, /lg:grid-cols-2/)
})

test('KAN-563 compacts the Profile tab selector like the wide Athlete bottom navigation', () => {
  assert.match(profile, /<TabsList[^>]*className=['"][^'"]*w-full[^'"]*sm:w-auto/)
  assert.match(profile, /sm:mx-auto/)
  assert.match(profile, /sm:gap-1/)
  assert.match(profile, /sm:rounded-\[var\(--radius-ept-overlay\)\]/)
})
