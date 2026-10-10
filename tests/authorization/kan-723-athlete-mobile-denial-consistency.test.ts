import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('app/[locale]/(mobile)/page.tsx', 'utf8')
const plan = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
const stats = readFileSync('app/[locale]/(mobile)/stats/page.tsx', 'utf8')
const profile = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')

test('KAN-723 denial surfaces on four Athlete mobile pages use one localized AthletePageState', () => {
  for (const [name, source] of Object.entries({ home, plan, stats, profile })) {
    assert.match(source, /AthletePageState/, name)
    assert.match(source, /(?:tPlan|t)\('unauthorized'\)/, name)
  }
  assert.match(stats, /result\.status === 'denied'/)
  assert.doesNotMatch(stats, /t\('summary\.denied'\)/)
  assert.match(profile, /athleteResult\.forbidden/)
  assert.doesNotMatch(profile, /return <ProfileTab \/>/)
})

test('KAN-723 stats/profile continue distinguishing loading failures from SELF denial', () => {
  assert.match(stats, /result\.status === 'error'/)
  assert.match(stats, /t\('summary\.error'\)/)
  assert.match(profile, /performanceResult\.error === 'not_authorized'/)
  assert.match(profile, /performanceStatus/)
})
