import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const hook = readFileSync('features/workouts/hooks/useLogWorkoutDialog.ts', 'utf8')

test('KAN-815 hook must delegate to tested validation boundary before calling onSave', () => {
  assert.match(hook, /import\s*\{\s*withValidatedRealizedTrainingMetrics\s*\}\s*from\s*['"]@\/lib\/numeric\/realized-training-save-boundary['"]/)
  assert.match(hook, /await withValidatedRealizedTrainingMetrics\(/)
  assert.match(hook, /distance:\s*distance,\s*gain:\s*gain,\s*avgHr:\s*avgHr/)
  assert.match(hook, /if\s*\(saveResult\.status\s*===\s*['"]invalid['"]\)/)
  assert.match(hook, /setSaveError\(['"]invalidMetric['"]\)/)
})

test('KAN-815 hook keeps authorization/economic save callback and user draft on DENY', () => {
  assert.match(hook, /await onSave\(payload\)/)
  assert.match(hook, /blocked_for_prior_debt/)
  assert.match(hook, /economic_evidence_unavailable/)
  assert.doesNotMatch(hook, /resetForm\(\)/)
})
