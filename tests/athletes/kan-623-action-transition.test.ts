import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('KAN-623 edit submit prepares intent before dispatching inside a React transition', () => {
  const value = fs.readFileSync('features/athletes/components/AthleteForm.tsx', 'utf8')
  assert.match(value, /prepareAthleteEditFormData/)
  assert.match(value, /startTransition\(\(\) => \{[\s\S]*formAction\(formData\)[\s\S]*\}\)/)
})
