import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('KAN-623 edit allows missing administrative email while create still requires it', () => {
  const value = fs.readFileSync('features/athletes/components/AthleteForm.tsx', 'utf8')

  assert.match(
    value,
    /name='email'[\s\S]*required=\{!athlete\}/,
    'email should be required only when creating an athlete',
  )
})
