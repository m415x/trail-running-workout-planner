import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-359/T9h actual weekly and workout CardHeader consumers scale title and subtitle in Athlete scope', () => {
  const weekly = read('features/workouts/components/WeeklyCalendarCard.tsx')
  const workout = read('features/workouts/components/WorkoutCard.tsx')
  const header = read('components/ui/custom/section-header.tsx')
  assert.match(weekly, /<CardHeader\s+title=\{cycle\.title\}\s+subtitle=\{subtitleWeeklyCalendar\}/)
  assert.match(workout, /<CardHeader\s+title=\{headerTitle\}/)
  assert.match(header, /--athlete-text-title/, 'nested header title consumes Athlete title')
  assert.match(header, /--athlete-text-caption/, 'nested subtitle consumes Athlete caption')
  assert.match(header, /var\(--athlete-text-title,\s*17px\)/, 'non-Athlete header retains 17px fallback')
  assert.match(header, /var\(--athlete-text-caption,\s*11px\)/, 'non-Athlete subtitle retains 11px fallback')
})

test('KAN-359/T9h actual seven-day selector scales semantic labels without changing week navigation', () => {
  const carousel = read('features/workouts/components/WeeklyCarousel.tsx')
  const day = read('features/workouts/components/DaySelectorButton.tsx')
  assert.match(carousel, /grid-cols-7/, 'calendar keeps seven columns')
  assert.match(carousel, /<DaySelectorButton/, 'calendar uses the actual day consumer')
  assert.match(day, /--athlete-text-caption/, 'weekday and today captions scale with the preset')
  assert.match(day, /--athlete-text-title/, 'day number scales with the preset')
  assert.match(day, /onClick=\{\(\) => onSelectDay\(index\)\}/, 'day selection remains interactive')
  assert.match(day, /<DayStatusIndicator/, 'day status indicators remain present')
  assert.match(day, /focus-visible:|<button/, 'day selection remains a native keyboard-focusable button')
})

test('KAN-359/T9h Athlete tokens stay scoped, with fixed distance hierarchy documented', () => {
  const css = read('features/athlete-typography/typography.css')
  const workout = read('features/workouts/components/WorkoutCard.tsx')
  assert.match(css, /\.athlete-typography\s*\{/)
  assert.match(workout, /--athlete-text-display/, 'primary distance retains display hierarchy and scales with preset')
  assert.doesNotMatch(css, /(?:^|[},\n])\s*(?:html|body|:root)\s*\{/m)
})
