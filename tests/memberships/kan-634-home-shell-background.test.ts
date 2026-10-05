import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAthleteEconomicShellBackground } from '../../lib/memberships/athlete-home-economic-shell'

test('KAN-634 maps the approved H4/H5 tones to static light/dark shell classes', () => {
  assert.equal(resolveAthleteEconomicShellBackground('normal'), 'bg-background')
  assert.equal(resolveAthleteEconomicShellBackground('neutral'), 'bg-background')
  assert.match(resolveAthleteEconomicShellBackground('warning'), /bg-amber-100/)
  assert.match(resolveAthleteEconomicShellBackground('warning'), /dark:bg-amber-900/)
  assert.match(resolveAthleteEconomicShellBackground('danger'), /bg-red-100/)
  assert.match(resolveAthleteEconomicShellBackground('danger'), /dark:bg-red-900/)
})

test('KAN-634 shell only maps tones, never makes route access decisions', () => {
  for (const tone of ['normal', 'neutral', 'warning', 'danger'] as const) {
    const css = resolveAthleteEconomicShellBackground(tone)
    assert.match(css, /^bg-/)
    assert.doesNotMatch(css, /hidden|pointer-events-none|invisible/)
  }
})
