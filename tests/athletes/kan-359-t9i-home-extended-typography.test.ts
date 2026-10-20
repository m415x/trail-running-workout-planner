import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-359/T9i external portals receive Athlete scope locally, without global or Coach selector', () => {
  const popover = read('components/ui/popover.tsx')
  const dialog = read('components/ui/dialog.tsx')
  const weekly = read('features/workouts/components/WeeklyCalendarCard.tsx')
  const logging = read('features/workouts/components/LogWorkoutDialog.tsx')
  assert.match(popover, /PopoverPrimitive\.Portal/, 'calendar popover uses a portal')
  assert.match(dialog, /DialogPortal/, 'logging dialog uses a portal')
  assert.match(weekly, /<PopoverContent[^>]*className=[^>]*athlete-typography/s, 'the actual calendar popup must receive Athlete scope')
  assert.match(logging, /<DialogContent[^>]*className=[^>]*athlete-typography/s, 'the actual logging popup must receive Athlete scope')
  assert.doesNotMatch(read('features/athlete-typography/typography.css'), /(?:^|[},\n])\s*(?:html|body|:root)\s*\{/m)
})

test('KAN-359/T9i workout distance and zone status scale semantically without losing projection', () => {
  const workout = read('features/workouts/components/WorkoutCard.tsx')
  const pills = read('components/ui/custom/pills.tsx')
  assert.match(workout, /--athlete-text-display/, 'distance should scale as a display role')
  assert.match(workout, /\{workout\.distance\}/)
  assert.match(pills, /--athlete-text-title/, 'zone code must scale')
  assert.match(pills, /--athlete-text-caption/, 'zone intensity must scale')
  assert.match(pills, /zoneInfo\.code/)
  assert.match(pills, /zoneInfo\.pct/)
})

test('KAN-359/T9i real month picker and logging controls scale within scoped portals', () => {
  const picker = read('features/workouts/components/WeekCalendarPicker.tsx')
  const dialog = read('features/workouts/components/LogWorkoutDialog.tsx')
  assert.match(picker, /--athlete-text-title/)
  assert.match(picker, /--athlete-text-caption/)
  assert.match(picker, /grid-cols-7/)
  assert.match(picker, /onSelectDate\(date\)/)
  for (const id of ['performedAt', 'distance', 'durationHours', 'durationMinutes', 'durationSeconds', 'elevationGain', 'averageHeartRate']) {
    assert.ok(dialog.includes(`id='${id}'`), `preserve realized training input ${id}`)
  }
  assert.match(dialog, /--athlete-text-heading|--athlete-text-title/)
  assert.match(dialog, /--athlete-text-body-compact/)
  assert.match(dialog, /--athlete-text-caption/)
  assert.match(dialog, /handleSave\(\)/)
})

test('KAN-359/T9i elevation SVG tick props and map meeting-point action use athlete roles', () => {
  const elevation = read('features/workouts/components/ElevationProfileCard.tsx')
  const map = read('features/workouts/components/RouteMapCard.tsx')
  assert.match(elevation, /--athlete-text-caption/, 'legend should scale')
  assert.match(elevation, /fontSize:\s*[^}]*athlete|fontSize=\{[^}]*[Tt]ypography/, 'Recharts X/Y tick sizes must depend on Athlete preference, not fixed literals')
  assert.match(elevation, /<XAxis/)
  assert.match(elevation, /<YAxis/)
  assert.match(map, /--athlete-text-label/, 'meeting-point label must scale')
  assert.match(map, /window\.open\(navigationUrl/)
})
