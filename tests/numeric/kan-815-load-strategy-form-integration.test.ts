import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync('features/planning/components/LoadStrategyForm.tsx', 'utf8')

test('KAN-815/A2 LoadStrategyForm retains regional text drafts separately from numeric domain values', () => {
  assert.match(form, /parseLoadStrategyNumericDraft/)
  assert.match(form, /numericDrafts/)
  assert.match(form, /setNumericDrafts/)
  assert.match(form, /type='text'/)
  assert.match(form, /inputMode='decimal'/)
  assert.doesNotMatch(form, /Number\(nextValue\)/)
})

test('KAN-815/A2 unfinished strategy draft does not silently submit previous or zero values', () => {
  assert.match(form, /hasInvalidNumericDraft/)
  assert.match(form, /disabled=\{[^}]*hasInvalidNumericDraft/)
  assert.match(form, /normalized\.status\s*===\s*['"]valid['"]/)
  assert.doesNotMatch(form, /onChange=\{\(value\) => handleValueChange\([^\n]*value \?\? 0\)/)
})

test('KAN-815/A2 preserves existing domain validator, serialized values and suggestion reset', () => {
  assert.match(form, /validateLoadStrategy\(strategy\)/)
  assert.match(form, /JSON\.stringify\(strategy\.values\)/)
  assert.match(form, /createGroupPlanWithLoadStrategy/)
  assert.match(form, /suggestLoadStrategy/)
  assert.match(form, /resetStrategy/)
})
