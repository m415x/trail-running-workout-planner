import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'features/workouts/hooks/useWorkoutCard.ts'),
  'utf8',
)

test('workout card resolves workout type labels through Workouts translations', () => {
  assert.match(source, /useTranslations\(['"]Workouts['"]\)/)
  assert.match(source, /t\(['"]types\./)
  assert.doesNotMatch(source, /getWorkoutTypeLabel/)
})
