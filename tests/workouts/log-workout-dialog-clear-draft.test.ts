import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const hook = readFileSync('features/workouts/hooks/useLogWorkoutDialog.ts', 'utf8')
const dialog = readFileSync('features/workouts/components/LogWorkoutDialog.tsx', 'utf8')

test('KAN-577 Clear form empties the editing draft rather than restoring saved values', () => {
  const reset = hook.match(/const resetForm = useCallback\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\)/)?.[1] ?? ''
  assert.ok(reset, 'resetForm must exist')
  assert.doesNotMatch(reset, /applyValues\(initialInput\)/)
  for (const setter of [
    'setPerformedLocal', 'setDistance', 'setGain', 'setTimeHr',
    'setTimeMin', 'setTimeSec', 'setAvgHr', 'setAthleteNotes',
  ]) {
    assert.match(reset, new RegExp(`${setter}\\(''\\)`), `${setter} must be cleared`)
  }
  assert.match(reset, /setAssessment\(\{\s*feeling:\s*null,\s*rpe:\s*null,?\s*\}\)/)
  assert.match(reset, /setSaveError\(null\)/)
  assert.match(dialog, /<GlassOutlineButton onClick=\{resetForm\} disabled=\{isSaving\}>/)
})

test('KAN-577 Clear form does not erase persisted workout or alter dialog-open hydration', () => {
  const reset = hook.match(/const resetForm = useCallback\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\)/)?.[1] ?? ''
  assert.doesNotMatch(reset, /onSave|handleSave|onClose|saving\.current|initialInput/)
  assert.match(hook, /useEffect\(\(\) => \{\s*if \(isOpen\) applyValues\(initialInput\)/)
  assert.match(hook, /if \(!input\) return \{ \.\.\.emptyValues, performedLocal: localDateTimeInput\(new Date\(\)\.toISOString\(\)\) \}/)
})
