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


test('the canonical upgrade contract defines supported legacy-state handling', () => {
  const contractPath = path.join(process.cwd(), 'db', 'sqlite', 'upgrade-contract.ts')
  assert.equal(fs.existsSync(contractPath), true, 'missing SQLite upgrade-state contract')

  const contract = fs.readFileSync(contractPath, 'utf8')
  assert.match(contract, /fresh/i)
  assert.match(contract, /versioned/i)
  assert.match(contract, /push/i)
  assert.match(contract, /legacy/i)
  assert.match(contract, /reject/i)
  assert.match(contract, /preserv/i)
})


test('the SQLite verifier owns detection of the recorded_by_user_id drift regression', () => {
  const verifierPath = path.join(process.cwd(), 'scripts', 'verify-sqlite.ts')
  const verifier = fs.readFileSync(verifierPath, 'utf8')

  assert.match(verifier, /field_performance_tests/)
  assert.match(verifier, /recorded_by_user_id/)
  assert.match(verifier, /foreign_key_check/)
})

test('the canonical upgrade runner invokes the verifier after migration', () => {
  const runnerPath = path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts')
  const runner = fs.readFileSync(runnerPath, 'utf8')

  assert.match(runner, /migrate/)
  assert.match(runner, /verify-sqlite/)
})
