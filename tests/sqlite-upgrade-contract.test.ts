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
  assert.match(runner, /meta[/\\\\]_journal\.json/)
  assert.match(runner, /entry\.tag/)
  assert.match(runner, /entry\.when/)
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
  const metadataIndex = legacyBlock.indexOf("establishCanonicalMigrationMetadata(sqlite, '0001_realized_training_timing')")

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


test('fresh bootstrap records every migration already represented by the pushed HEAD schema', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')
  assert.match(runner, /journal\.entries\.slice\(0, appliedCount\)/)
  assert.match(runner, /appliedThroughTag === undefined[\s\S]*journal\.entries\.length/)
})


test('legacy reconciliation records only migrations physically reconciled before Drizzle migrate', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(runner, /establishCanonicalMigrationMetadata\(sqlite,\s*['"]0001_realized_training_timing['"]\)/)
  assert.match(runner, /establishCanonicalMigrationMetadata\(sqlite\)/)
})


test('canonical migration metadata derives entries from the Drizzle journal instead of hard-coded counts', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.match(runner, /meta[/\\\\]_journal\.json/)
  assert.doesNotMatch(runner, /establishCanonicalMigrationMetadata\(sqlite,\s*6\)/)
})


test('SQLite verification covers empty, full-seed, partial-seed, upgrade, preservation, drift and rerun scenarios', () => {
  const verifierPath = path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts')

  assert.ok(fs.existsSync(verifierPath), 'missing SQLite scenario verifier')
  const verifier = fs.readFileSync(verifierPath, 'utf8')

  assert.match(verifier, /empty/i)
  assert.match(verifier, /seedFull/)
  assert.match(verifier, /seedFeature/)
  assert.match(verifier, /upgrade/i)
  assert.match(verifier, /preserv/i)
  assert.match(verifier, /drift/i)
  assert.match(verifier, /rerun|idempot/i)
})


test('SQLite scenario harness executes empty bootstrap without invoking seed composition', () => {
  const verifierPath = path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts')
  const verifier = fs.readFileSync(verifierPath, 'utf8')

  assert.match(verifier, /runEmptyBootstrapScenario/)
  assert.match(verifier, /upgrade-sqlite/)
  assert.match(verifier, /verify-sqlite/)
  assert.doesNotMatch(
    verifier.match(/function runEmptyBootstrapScenario[\s\S]*?\n}/)?.[0] ?? '',
    /seedFull|seedFeature/,
  )
})


test('SQLite scenario verifier can execute the empty bootstrap scenario from its CLI', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  assert.match(verifier, /process\.argv/)
  assert.match(verifier, /['"]empty['"]/)
  assert.match(verifier, /runEmptyBootstrapScenario\(/)
})


test('SQLite scenario harness implements full-seed execution with explicit seedFull composition', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  assert.match(verifier, /runFullSeedScenario/)
  assert.match(
    verifier.match(/function runFullSeedScenario[\s\S]*?\n}/)?.[0] ?? '',
    /seedFull/,
  )
  assert.match(verifier, /scenario === ['"]full-seed['"]/)
  assert.match(verifier, /runFullSeedScenario\(/)
})


test('SQLite scenario harness implements useful partial-seed execution with seedFeature', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  const scenario = verifier.match(/function runPartialSeedScenario[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(verifier, /runPartialSeedScenario/)
  assert.match(scenario, /seedFeature/)
  assert.match(scenario, /['"]groups['"]/)
  assert.match(scenario, /['"]competitions['"]/)
  assert.match(verifier, /scenario === ['"]partial-seed['"]/)
  assert.match(verifier, /runPartialSeedScenario\(/)
})


test('SQLite scenario harness implements a representative legacy upgrade to HEAD', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  const scenario = verifier.match(/function runUpgradeScenario[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(verifier, /runUpgradeScenario/)
  assert.match(scenario, /createRepresentativeLegacyDatabase/)
  assert.match(scenario, /upgrade-sqlite/)
  assert.match(scenario, /verify-sqlite/)
  assert.match(verifier, /scenario === ['"]upgrade['"]/)
  assert.match(verifier, /runUpgradeScenario\(/)
})


test('SQLite scenario harness verifies existing application data survives the supported upgrade', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  const scenario = verifier.match(/function runPreservationScenario[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(verifier, /runPreservationScenario/)
  assert.match(scenario, /createRepresentativeLegacyDatabase/)
  assert.match(scenario, /INSERT/i)
  assert.match(scenario, /SELECT/i)
  assert.match(scenario, /upgrade-sqlite/)
  assert.match(verifier, /scenario === ['"]preservation['"]/)
  assert.match(verifier, /runPreservationScenario\(/)
})


test('SQLite scenario harness detects schema drift between fresh and upgraded databases', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  const scenario = verifier.match(/function runDriftScenario[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(verifier, /runDriftScenario/)
  assert.match(scenario, /createRepresentativeLegacyDatabase/)
  assert.match(verifier, /function readNormalizedSchema[\s\S]*sqlite_master/)
  assert.match(scenario, /readNormalizedSchema/)
  assert.match(scenario, /upgrade-sqlite/)
  assert.match(scenario, /Schema drift/i)
  assert.match(verifier, /scenario === ['"]drift['"]/)
  assert.match(verifier, /runDriftScenario\(/)
})


test('SQLite scenario harness verifies the supported upgrade is safe to rerun at HEAD', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  const scenario = verifier.match(/function runRerunScenario[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(verifier, /runRerunScenario/)
  assert.match(scenario, /createRepresentativeLegacyDatabase/)
  assert.match(scenario, /upgrade-sqlite/g)
  assert.match(scenario, /verify-sqlite/)
  assert.match(scenario, /readNormalizedSchema/)
  assert.match(verifier, /scenario === ['"]rerun['"]/)
  assert.match(verifier, /runRerunScenario\(/)
})


test('SQLite seed ownership is consolidated under db/seeds with stable package entrypoints', () => {
  const scripts = packageJson.scripts ?? {}
  const legacyRootSeedFiles = [
    'seed-race-catalog-fixtures.ts',
    'seed-realized-training-fixtures.ts',
    'seed-plan-real-comparison-fixtures.ts',
  ]

  for (const file of legacyRootSeedFiles) {
    assert.equal(
      fs.existsSync(path.join(process.cwd(), 'db', file)),
      false,
      `${file} must not remain as root-level seed ownership`,
    )
    assert.equal(
      fs.existsSync(path.join(process.cwd(), 'db', 'seeds', file.replace(/^seed-/, ''))),
      true,
      `${file} must be owned under db/seeds`,
    )
  }

  assert.match(scripts['db:seed:race-catalog'] ?? '', /db\/seeds\/race-catalog-fixtures\.ts/)
  assert.match(scripts['db:seed:realized-training'] ?? '', /db\/seeds\/realized-training-fixtures\.ts/)
  assert.match(scripts['db:seed:plan-real'] ?? '', /db\/seeds\/plan-real-comparison-fixtures\.ts/)
})


test('SQLite exposes one aggregate verification gate covering every supported scenario', () => {
  const scripts = packageJson.scripts ?? {}
  const command = scripts['db:sqlite:check'] ?? ''

  assert.match(command, /verify-sqlite-scenarios/)
  for (const scenario of ['empty', 'full-seed', 'partial-seed', 'upgrade', 'preservation', 'drift', 'rerun']) {
    assert.match(command, new RegExp(`\\b${scenario}\\b`), `db:sqlite:check must include ${scenario}`)
  }
})


test('supported SQLite operations and recovery are durably documented', () => {
  const docPath = path.join(process.cwd(), 'docs', 'architecture', 'platform', 'sqlite-local-operations.md')
  assert.equal(fs.existsSync(docPath), true, 'missing durable SQLite operations documentation')

  const doc = fs.readFileSync(docPath, 'utf8')
  assert.match(doc, /db:sqlite:upgrade/)
  assert.match(doc, /db:sqlite:verify/)
  assert.match(doc, /db:sqlite:check/)
  assert.match(doc, /db:seed:base/)
  assert.match(doc, /db:seed:race-catalog/)
  assert.match(doc, /db:seed:realized-training/)
  assert.match(doc, /db:seed:plan-real/)
  assert.match(doc, /empty/i)
  assert.match(doc, /partial/i)
  assert.match(doc, /inconsistent/i)
  assert.match(doc, /do not delete|do not overwrite/i)
})


test('canonical SQLite runner invokes Drizzle Kit through its supported package executable', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.doesNotMatch(runner, /require\.resolve\(['"]drizzle-kit\/bin\.cjs['"]\)/)
  assert.match(runner, /drizzle-kit/)
})


test('canonical SQLite runner does not resolve non-exported Drizzle Kit package metadata', () => {
  const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'upgrade-sqlite.ts'), 'utf8')

  assert.doesNotMatch(runner, /require\.resolve\(['"]drizzle-kit\/package\.json['"]\)/)
})
