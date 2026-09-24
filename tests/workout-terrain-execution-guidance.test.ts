import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('WorkoutCard uses terrain evidence to suppress flat-reference pace targets', async () => {
  const source = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')

  assert.match(source, /workout[.]type\s*===\s*['"]Trail['"]/)
  assert.match(source, /workout[.]type\s*===\s*['"]Hills['"]/)
  assert.match(source, /executionGuidance[.]quality[?][.]status\s*===\s*['"]available['"]\s*&&\s*!shouldPrioritizeTerrainEffort/)
})

test('WorkoutCard can use known positive grade as terrain evidence', async () => {
  const source = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')

  assert.match(source, /TrackData[?][.]maxGradePct/)
  assert.match(source, /maxGradePct[^\r\n]*>\s*0/)
})

test('new Trail and Hills sessions default coach notes to effort over pace without overriding edits', async () => {
  const source = await readFile('features/sessions/components/SessionForm.tsx', 'utf8')

  assert.match(source, /t\(['"]form\.trailEffortNote['"]\)/)
  assert.match(source, /type === 'Trail' \|\| type === 'Hills'/)
  assert.doesNotMatch(source, /Priorizá el esfuerzo sobre el ritmo\./)
  assert.match(source, /session\?\.notes/)
})

test('WorkoutCard does not render terrain priority as a separate guidance card', async () => {
  const source = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')

  assert.doesNotMatch(source, /card[.]guidance[.]terrainPriority/)
})


test('variable-terrain WorkoutCard keeps planned group duration but suppresses derived pace and speed as athlete targets', async () => {
  const card = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')
  const hook = await readFile('features/workouts/hooks/useWorkoutCard.ts', 'utf8')

  assert.match(card, /shouldPrioritizeTerrainEffort\s*\?\s*stats[.]filter/)
  assert.doesNotMatch(card, /stat[.]kind\s*!==\s*['"]duration['"]/)
  assert.match(card, /stat[.]kind\s*!==\s*['"]pace['"]/)
  assert.match(card, /stat[.]kind\s*!==\s*['"]speed['"]/)
  assert.match(hook, /kind:\s*['"]duration['"]/)
  assert.match(hook, /kind:\s*['"]pace['"]/)
  assert.match(hook, /kind:\s*['"]speed['"]/)
})
