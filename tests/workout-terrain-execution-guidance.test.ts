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

  assert.match(source, /TRAIL_EFFORT_NOTE/)
  assert.match(source, /type === 'Trail' \|\| type === 'Hills'/)
  assert.match(source, /Priorizá el esfuerzo sobre el ritmo/)
  assert.match(source, /session\?\.notes/)
})

test('WorkoutCard does not render terrain priority as a separate guidance card', async () => {
  const source = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')

  assert.doesNotMatch(source, /card[.]guidance[.]terrainPriority/)
})
