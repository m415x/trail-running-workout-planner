import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const fullCatalogConsumers = [
  'app/[locale]/dashboard/templates/page.tsx',
  'app/actions/session-actions.ts',
  'app/actions/session-generation-actions.ts',
  'features/sessions/components/SessionForm.tsx',
  'features/workout-templates/components/WorkoutTemplateForm.tsx',
  'lib/workout-templates/workout-template-validator.ts',
]

test('full workout type consumers use the canonical catalog instead of duplicating it', () => {
  for (const relativePath of fullCatalogConsumers) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

    assert.match(source, /(?:WORKOUT_TYPES|isWorkoutType)/, relativePath)
    const workoutTypeLiterals = [
      'Base',
      'Long',
      'Intervals',
      'Trail',
      'Speed',
      'Fartlek',
      'PAM',
      'Hills',
      'Rest',
      'Race',
    ]
    const duplicatedValues = workoutTypeLiterals.filter(
      (type) => new RegExp(`['"]${type}['"]`).test(source),
    )

    assert.notDeepEqual(
      new Set(duplicatedValues),
      new Set(workoutTypeLiterals),
      relativePath,
    )
  }
})
