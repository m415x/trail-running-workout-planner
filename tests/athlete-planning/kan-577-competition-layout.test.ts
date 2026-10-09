import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const plan = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
const competition = readFileSync('app/[locale]/(mobile)/plan/competition/page.tsx', 'utf8')

test('KAN-577 Athlete Plan competitions uses the same centered desktop width and mobile gutter as Plan', () => {
  const planContainer = plan.match(/<div className='([^']*max-w-5xl[^']*)'/)?.[1]
  assert.ok(planContainer, 'Plan must continue declaring a bounded container')
  const competitionContainer = competition.match(/<section className='([^']*)'/)?.[1]
  assert.ok(competitionContainer, 'competition page needs its own layout container')
  for (const token of ['mx-auto', 'w-full', 'max-w-5xl', 'px-4', 'sm:px-6']) {
    assert.ok(planContainer.split(' ').includes(token), `Plan baseline is missing ${token}`)
    assert.ok(competitionContainer.split(' ').includes(token),
      `competition must match Plan container token ${token}`)
  }
})

test('KAN-577 competition error state stays within the bounded width instead of spanning the entire shell', () => {
  assert.match(competition, /result\.status !== 'loaded'/)
  assert.match(competition, /if \(result\.status !== 'loaded'\) return <(?:p|section|div) className='[^']*max-w-5xl[^']*'/)
})

test('KAN-577 competition preserves navigation, registration grid and empty state', () => {
  assert.ok(competition.includes("href='/plan'"))
  assert.ok(competition.includes("t('competitionDetail.registrations.noUpcoming')"))
  assert.ok(competition.includes('result.data.upcoming.map'))
  assert.ok(competition.includes('md:grid-cols-2'))
})
