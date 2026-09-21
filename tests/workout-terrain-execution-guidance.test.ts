import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('WorkoutCard communicates effort over pace only for trail or hill terrain', async () => {
  const source = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')

  assert.match(source, /workout[.]type\s*===\s*['"]Trail['"]/)
  assert.match(source, /workout[.]type\s*===\s*['"]Hills['"]/)
  assert.match(source, /terrainPriority/)
})

test('WorkoutCard can use known positive grade as terrain evidence', async () => {
  const source = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')

  assert.match(source, /TrackData[?][.]maxGradePct/)
  assert.match(source, /maxGradePct\s*>\s*0/)
})
