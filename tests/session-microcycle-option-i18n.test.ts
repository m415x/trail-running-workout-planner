import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actions = fs.readFileSync(path.join(process.cwd(), 'app/actions/session-actions.ts'), 'utf8')
const form = fs.readFileSync(path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'), 'utf8')

test('Session form options keep microcycle data structural and localize labels in the UI', () => {
  assert.doesNotMatch(actions, /label:\s*`\$\{plan\.title\} · Semana/)
  assert.match(actions, /weekNumber:\s*microcycle\.weekNumber/)
  assert.match(actions, /startDate:\s*microcycle\.startDate/)
  assert.match(actions, /endDate:\s*microcycle\.endDate/)

  assert.match(form, /form\.prescriptions\.microcycleOption/)
  assert.doesNotMatch(form, />\{microcycle\.label\}<\/option>/)
})
