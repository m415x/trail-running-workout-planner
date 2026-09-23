import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'),
  'utf8',
)
const es = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/es/planning/sessions.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/en/planning/sessions.json'), 'utf8'))
const fragmentRegistry = fs.readFileSync(path.join(process.cwd(), 'i18n/message-fragments.ts'), 'utf8')
const loader = fs.readFileSync(path.join(process.cwd(), 'i18n/messages.ts'), 'utf8')

function keyShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(keyShape)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, keyShape(child)]))
  }
  return true
}

test('Sessions uses the canonical modular message catalog with ES/EN parity', () => {
  assert.deepEqual(keyShape(es), keyShape(en))
  assert.match(fragmentRegistry, /'planning\/sessions'/)
  assert.match(loader, /messages\/en\/planning\/sessions\.json/)
  assert.match(loader, /messages\/es\/planning\/sessions\.json/)
})

test('SessionForm template options localize workout type labels', () => {
  assert.match(source, /workoutTypeT\(`types\.\$\{workout\.type\}`\)/)
  assert.doesNotMatch(source, /\{workout\.title\} · \{workout\.type\}/)
})
