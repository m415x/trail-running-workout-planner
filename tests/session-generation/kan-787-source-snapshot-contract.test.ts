import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveAuthorizedGenerationSources,
  sameCanonicalGenerationSources,
} from '@/lib/session-generation/authorized-generation-source-snapshot'

const base = {
  plan: { status: 'allowed' as const, value: { id: 'base-a', teamId: 'team-a', planningCohortId: null as string | null, microcycles: [{ id: 'm1', loadKm: 42, intensity: 'Z2' }] } },
  preferences: { status: 'allowed' as const, value: { frequency: 3, pattern: ['mon', 'wed', 'sat'] } },
  templates: { status: 'allowed' as const, value: [{ id: 't1', teamId: 'team-a', archived: false, distanceKm: 12 }] },
  competitions: { status: 'allowed' as const, value: [] as Array<{ id: string; date: string; distanceKm: number }> },
}

test('KAN-787/T3a rejects missing and DENY sources instead of silently using empty defaults', () => {
  const sources = structuredClone(base)
  assert.equal(resolveAuthorizedGenerationSources('team-a', sources).status, 'allowed')
  assert.equal(resolveAuthorizedGenerationSources('team-a', { ...sources, competitions: { status: 'denied' } }).status, 'denied')
  assert.equal(resolveAuthorizedGenerationSources('team-a', { ...sources, templates: { status: 'unavailable' } }).status, 'unavailable')
  assert.equal(resolveAuthorizedGenerationSources('team-a', { ...sources, preferences: { status: 'denied' } }).status, 'denied')
  assert.equal(resolveAuthorizedGenerationSources('team-b', sources).status, 'denied')
})

test('KAN-787/T3a Base/Variant and every material source contribute to canonical freshness', () => {
  const reference = resolveAuthorizedGenerationSources('team-a', structuredClone(base))
  assert.equal(reference.status, 'allowed')
  if (reference.status !== 'allowed') return
  const changes = [
    (x: typeof base) => { x.plan.value.microcycles[0].loadKm = 43 },
    (x: typeof base) => { x.plan.value.microcycles[0].intensity = 'Z3' },
    (x: typeof base) => { x.plan.value.planningCohortId = 'cohort-a' },
    (x: typeof base) => { x.preferences.value.frequency = 4 },
    (x: typeof base) => { x.preferences.value.pattern.push('sun') },
    (x: typeof base) => { x.templates.value[0].distanceKm = 20 },
    (x: typeof base) => { x.competitions.value.push({ id: 'race-a', date: '2027-04-12', distanceKm: 42 }) },
  ]
  for (const change of changes) {
    const copy = structuredClone(base)
    change(copy)
    const modified = resolveAuthorizedGenerationSources('team-a', copy)
    assert.equal(modified.status, 'allowed')
    if (modified.status === 'allowed') assert.equal(sameCanonicalGenerationSources(reference.canonical, modified.canonical), false)
  }
  const equivalent = resolveAuthorizedGenerationSources('team-a', structuredClone(base))
  assert.equal(equivalent.status, 'allowed')
  if (equivalent.status === 'allowed') assert.equal(sameCanonicalGenerationSources(reference.canonical, equivalent.canonical), true)
})
