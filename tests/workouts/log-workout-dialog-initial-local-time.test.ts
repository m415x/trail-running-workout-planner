import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const hook = readFileSync('features/workouts/hooks/useLogWorkoutDialog.ts', 'utf8')
const fields = readFileSync('lib/realized-training/manual-capture-fields.ts', 'utf8')

test('KAN-577 initializes new workout occurrence time from device-local clock when dialog opens', () => {
  assert.match(hook, /function localDateTimeInput\(value:/)
  assert.match(hook, /if \(!input\)\s*return\s*\{\s*\.\.\.emptyValues,\s*performedLocal:\s*localDateTimeInput\(new Date\(\)\.toISOString\(\)\)/)
  assert.match(hook, /useEffect\(\(\) => \{\s*if \(isOpen\) applyValues\(initialInput\)/)
  assert.doesNotMatch(hook, /useState\(localDateTimeInput\(new Date\(\)/, 'time must be captured on opening, not initial render')
})

test('KAN-577 preserves existing edit timestamp and local-to-UTC validation', () => {
  assert.match(hook, /performedLocal:\s*localDateTimeInput\(input\.performedAt\)/)
  assert.match(hook, /const performedAt = captureLocalInstant\(performedLocal\)/)
  assert.match(fields, /return parsed\.toISOString\(\)/)
})
