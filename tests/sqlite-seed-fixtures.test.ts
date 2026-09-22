import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const seedRoot = path.join(process.cwd(), 'db', 'seeds')

test('SQLite seed data is organized into the approved feature fixtures', () => {
  const expected = [
    'team-and-coach.ts',
    'athletes.ts',
    'groups.ts',
    'competitions.ts',
    'cohorts.ts',
    'planning-templates-and-sessions.ts',
  ]

  for (const file of expected) {
    assert.ok(fs.existsSync(path.join(seedRoot, file)), `missing feature seed: ${file}`)
  }
})

test('full SQLite seed composes feature fixtures instead of owning one monolithic implementation', () => {
  const seed = fs.readFileSync(path.join(process.cwd(), 'db', 'seed.ts'), 'utf8')

  assert.match(seed, /db\/seeds/)
  assert.match(seed, /team-and-coach/)
  assert.match(seed, /athletes/)
  assert.match(seed, /groups/)
  assert.match(seed, /competitions/)
  assert.match(seed, /cohorts/)
  assert.match(seed, /planning-templates-and-sessions/)
})
