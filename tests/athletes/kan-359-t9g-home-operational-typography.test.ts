import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path: string) => readFileSync(path, 'utf8')

// T9g is a contract test for actual Home consumers, not merely the existence
// of generic typography tokens. Runtime computed sizes and reflow remain a
// separate operator walkthrough across compact/extra-large.
test('KAN-359/T9g weekly cycle uses responsive Athlete roles for its header and progress', () => {
  const weekly = source('features/workouts/components/WeeklyCalendarCard.tsx')
  assert.match(weekly, /--athlete-text-caption/, 'weekly progress text should scale')
  assert.match(weekly, /--athlete-text-label/, 'cycle date/summary should scale')
  assert.match(weekly, /<WeeklyCarousel/, 'existing calendar interaction is preserved')
  assert.match(weekly, /<ProgressGradient/, 'existing volume progress projection is preserved')
})

test('KAN-359/T9g Home workouts scale session details while retaining capture and H5A action boundaries', () => {
  const workout = source('features/workouts/components/WorkoutCard.tsx')
  assert.match(workout, /--athlete-text-caption/, 'workout date and supporting labels should scale')
  assert.match(workout, /--athlete-text-body-compact/, 'notes, intensity and capture status should scale')
  assert.match(workout, /--athlete-text-title/, 'session title hierarchy should scale')
  assert.match(workout, /<StatPill/, 'metrics remain backed by existing projections')
  assert.match(workout, /createManualRealizedTrainingAction/, 'manual capture retains the server action')
  assert.match(workout, /<LogWorkoutDialog/, 'realized-training capture remains accessible')
})

test('KAN-359/T9g Home auxiliary metrics and economic notice adopt scoped roles without changing state contracts', () => {
  const metrics = source('components/ui/custom/pills.tsx')
  const weather = source('features/workouts/components/WeatherPillStrip.tsx')
  const economic = source('features/memberships/components/AthleteHomeEconomicNotice.tsx')
  assert.match(metrics, /--athlete-text-caption/, 'stat labels should respond to the preset')
  assert.match(metrics, /--athlete-text-body-compact/, 'stat values should respond to the preset')
  assert.match(weather, /--athlete-text-caption/, 'weather supporting metrics should scale')
  assert.match(economic, /--athlete-text-body-compact/, 'economic notice should scale')
  assert.match(economic, /state\.tone|state\.message|state\.status/, 'existing economic status semantics remain visible')
})

test('KAN-359/T9g typography remains Athlete-scoped and four presets do not alter global font size', () => {
  const css = source('features/athlete-typography/typography.css')
  const shell = source('components/layout/MobileShell.tsx')
  assert.match(shell, /className='athlete-typography/)
  for (const preset of ['compact', 'standard', 'large', 'extra-large']) {
    assert.ok(css.includes(`data-athlete-typography='${preset}'`))
  }
  assert.doesNotMatch(css, /(?:^|[},\n])\s*(?:html|body|:root)\s*\{/m)
})
