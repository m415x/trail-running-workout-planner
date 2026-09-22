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
]

test('full workout type consumers use the canonical catalog instead of duplicating it', () => {
  for (const relativePath of fullCatalogConsumers) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

    assert.match(source, /WORKOUT_TYPES/, relativePath)
    assert.doesNotMatch(
      source,
      /\['Base',\s*'Long',\s*'Intervals',\s*'Trail',\s*'Speed',\s*'Fartlek',\s*'PAM',\s*'Hills',\s*'Rest',\s*'Race'\]/,
      relativePath,
    )
    assert.doesNotMatch(
      source,
      /\['Base',\s*'Long',\s*'Intervals',\s*'Trail',\s*'Speed',\s*'Fartlek',\s*'PAM',\s*'Hills',\s*'Race',\s*'Rest'\]/,
      relativePath,
    )
  }
})
