import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'),
  'utf8',
)
const es = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/es.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/en.json'), 'utf8'))

function keyShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(keyShape)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, keyShape(child)]))
  }
  return true
}

test('SessionForm translation catalogs preserve ES/EN key parity', () => {
  assert.deepEqual(keyShape(es.Sessions), keyShape(en.Sessions))
})

test('SessionForm template options localize workout type labels', () => {
  assert.match(source, /workoutTypeT\(`types\.\$\{workout\.type\}`\)/)
  assert.doesNotMatch(source, /\{workout\.title\} · \{workout\.type\}/)
})

test('message catalogs retain established application namespaces', () => {
  for (const namespace of ['Common', 'Workouts', 'WorkoutTemplates', 'Sessions']) {
    assert.ok(es[namespace], `es missing ${namespace}`)
    assert.ok(en[namespace], `en missing ${namespace}`)
  }
})
