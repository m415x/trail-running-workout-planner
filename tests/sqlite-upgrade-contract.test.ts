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


test('the canonical runner classifies the database before applying migrations', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(runner, /classif/i)
  assert.match(runner, /unrecognized|inconsistent/i)
  assert.match(runner, /legacy/i)
})

test('the canonical runner does not silently migrate contradictory version metadata', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(runner, /recorded_by_user_id/)
  assert.match(runner, /reject|throw/i)
})


test('recognized legacy databases are reconciled instead of categorically rejected', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.doesNotMatch(runner, /Recognized legacy SQLite migration is not implemented yet/)
  assert.match(runner, /migrateRealizedTrainingTimingSqlite/)
  assert.match(runner, /migratePlanningCohortsSqlite/)
  assert.match(runner, /migrateCompetitionEntriesSqlite/)
  assert.match(runner, /migrateMacrocycleTargetRaceDateSqlite/)
})


test('legacy reconciliation establishes canonical migration metadata before Drizzle continues', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(runner, /__drizzle_migrations/)
  assert.match(runner, /0000_baseline|1789348463278/)
  assert.match(runner, /legacy/i)
})


test('legacy metadata establishment is safe to rerun without duplicate migration rows', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(
    runner,
    /SELECT\s+hash\s+FROM\s+__drizzle_migrations\s+WHERE\s+created_at\s*=\s*\?/i,
  )
  assert.match(runner, /if\s*\(row\)/)
  assert.match(runner, /continue/)
  assert.match(runner, /created_at/)
})


test('legacy metadata reconciliation rejects a conflicting canonical timestamp instead of trusting it', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(
    runner,
    /SELECT\s+hash\s+FROM\s+__drizzle_migrations\s+WHERE\s+created_at\s*=\s*\?/i,
  )
  assert.match(runner, /hash[\s\S]*!==|!==[\s\S]*hash/i)
  assert.match(runner, /conflict|inconsistent/i)
})


test('legacy reconciliation is atomic with canonical metadata establishment', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  const legacyBlock = runner.slice(runner.indexOf("if (state === 'legacy')"))
  const transactionIndex = legacyBlock.indexOf('sqlite.transaction(() => {')
  const firstMigrationIndex = legacyBlock.indexOf('migrateRealizedTrainingTimingSqlite(sqlite)')
  const metadataIndex = legacyBlock.indexOf('establishCanonicalMigrationMetadata(sqlite)')

  const planningIndex = legacyBlock.indexOf('migratePlanningCohortsSqlite(sqlite)')
  const competitionIndex = legacyBlock.indexOf('migrateCompetitionEntriesSqlite(sqlite)')
  const macrocycleIndex = legacyBlock.indexOf('migrateMacrocycleTargetRaceDateSqlite(sqlite)')

  assert.notEqual(transactionIndex, -1, 'legacy reconciliation must open an outer transaction after realized-training timing')
  assert.ok(firstMigrationIndex < transactionIndex, 'realized-training timing must retain its own transaction boundary')
  assert.ok(transactionIndex < planningIndex, 'outer transaction must start before the remaining legacy migrations')
  assert.ok(planningIndex < competitionIndex && competitionIndex < macrocycleIndex)
  assert.ok(metadataIndex > macrocycleIndex, 'canonical metadata must be established after physical reconciliation')
})


test('legacy reconciliation does not wrap the realized-training rebuild in an active transaction', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')
  const legacyBlock = runner.slice(runner.indexOf("if (state === 'legacy')"))
  const transactionIndex = legacyBlock.indexOf('sqlite.transaction(() => {')
  const realizedTimingIndex = legacyBlock.indexOf('migrateRealizedTrainingTimingSqlite(sqlite)')

  assert.ok(
    realizedTimingIndex < transactionIndex,
    'realized-training timing migration must run before the outer transaction because it rejects active transactions',
  )
})


test('legacy classification requires a reviewed schema fingerprint, not merely absence of Drizzle metadata', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(runner, /workout_logs/)
  assert.match(runner, /group_training_plans/)
  assert.match(runner, /macrocycles/)
  assert.match(runner, /unrecognized/i)
  assert.doesNotMatch(runner, /return hasMigrationMetadata \? 'versioned' : 'legacy'/)
})


test('fresh SQLite bootstrap creates the current schema instead of relying on baseline migration replay', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(runner, /state === 'fresh'/)
  assert.match(runner, /push/)
  assert.match(runner, /migrate/)
})


test('fresh SQLite bootstrap establishes migration metadata compatible with later upgrades', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')
  const freshBlock = runner.slice(
    runner.indexOf("if (state === 'fresh')"),
    runner.indexOf("if (state === 'legacy')"),
  )

  assert.match(freshBlock, /establishCanonicalMigrationMetadata\(sqlite\)/)
  assert.match(runner, /CREATE TABLE IF NOT EXISTS __drizzle_migrations/)
})
