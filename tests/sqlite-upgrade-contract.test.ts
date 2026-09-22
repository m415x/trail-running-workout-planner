import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
}

test('SQLite exposes one supported bootstrap and upgrade entrypoint', () => {
  const scripts = packageJson.scripts ?? {}

  assert.equal(typeof scripts['db:sqlite:upgrade'], 'string')
  assert.equal(typeof scripts['db:sqlite:verify'], 'string')
})

test('the supported SQLite upgrade owns the versioned Drizzle chain', () => {
  const scripts = packageJson.scripts ?? {}
  const command = scripts['db:sqlite:upgrade'] ?? ''

  assert.match(command, /sqlite/i)
  assert.doesNotMatch(command, /db:push/)
})

test('legacy one-off SQLite migrators are not package entrypoints', () => {
  const scripts = packageJson.scripts ?? {}
  const legacyEntrypoints = [
    'db:migrate:workout-templates:sqlite',
    'db:migrate:planning-cohorts:sqlite',
    'db:migrate:competition-entries:sqlite',
    'db:migrate:macrocycle-target-race-date:sqlite',
    'db:migrate:realized-training:sqlite',
  ]

  for (const name of legacyEntrypoints) {
    assert.equal(scripts[name], undefined, `${name} must be reconciled behind the canonical upgrade path`)
  }
})
