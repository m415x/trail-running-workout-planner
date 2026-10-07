import { migrateAthleteProfileIdentitySqlite } from "@/db/migrations/athlete-profile-identity-sqlite"
import { migrateCompetitionEntriesSqlite } from '@/db/migrations/competition-entries-sqlite'
import { migrateMacrocycleTargetRaceDateSqlite } from '@/db/migrations/macrocycle-target-race-date-sqlite'
import { migratePlanningCohortsSqlite } from '@/db/migrations/planning-cohorts-sqlite'
import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const require = createRequire(import.meta.url)
const tsxCli = require.resolve('tsx/cli')
const drizzleKitCli = resolve(import.meta.dirname, "../node_modules/drizzle-kit/bin.cjs")
const projectRoot = resolve(import.meta.dirname, '..')
const scenarioMode = process.env.SQLITE_SCENARIO_MODE === '1'
const sqlitePath = scenarioMode
  ? process.env.SQLITE_DATABASE_PATH ?? (() => { throw new Error('SQLITE_DATABASE_PATH is required for SQLite scenario verification') })()
  : 'sqlite.db'

function runNode(args: string[]): void {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function runDrizzleKit(args: string[]): void {
  const result = spawnSync(process.execPath, [drizzleKitCli, ...args], { cwd: projectRoot, stdio: "inherit", shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}


/**
 * Advances the recognized legacy route through the real canonical SQLite
 * migrations that precede KAN-615. Drizzle remains responsible for both the
 * physical changes and migration metadata; this function only bounds the
 * existing journal so the protected 0016 sentinel is never executed.
 */
function migrateLegacyCanonicalHistoryThrough0015(
  sqlite: Database.Database,
): void {
  const migrationsRoot = resolve(projectRoot, 'drizzle/sqlite')
  const journal = JSON.parse(
    readFileSync(resolve(migrationsRoot, 'meta/_journal.json'), 'utf8'),
  ) as {
    version: string
    dialect: string
    entries: Array<{
      idx: number
      version: string
      when: number
      tag: string
      breakpoints: boolean
    }>
  }

  const targetIndex = journal.entries.findIndex(
    entry => entry.tag === '0015_generation_explanation_provenance',
  )
  const protectedIndex = journal.entries.findIndex(
    entry => entry.tag === '0016_athlete_profile_identity',
  )

  if (
    targetIndex !== 15 ||
    protectedIndex !== 16 ||
    journal.entries[targetIndex]?.when !== 1790802000000 ||
    journal.entries[protectedIndex]?.when !== 1790802001000
  ) {
    throw new Error(
      'SQLite canonical legacy history is incompatible with the KAN-615 0015 boundary',
    )
  }

  const historicalEntries = journal.entries.slice(0, targetIndex + 1)
  if (historicalEntries.some((entry, index) => entry.idx !== index)) {
    throw new Error(
      'SQLite canonical legacy history is not contiguous through 0015',
    )
  }

  const directory = mkdtempSync(
    join(tmpdir(), 'kan-636-canonical-through-0015-'),
  )

  try {
    mkdirSync(resolve(directory, 'meta'))
    writeFileSync(
      resolve(directory, 'meta/_journal.json'),
      JSON.stringify({
        version: journal.version,
        dialect: journal.dialect,
        entries: historicalEntries,
      }),
    )

    for (const entry of historicalEntries) {
      copyFileSync(
        resolve(migrationsRoot, `${entry.tag}.sql`),
        resolve(directory, `${entry.tag}.sql`),
      )
    }

    migrate(drizzle(sqlite), {
      migrationsFolder: directory,
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function classifyExistingSqlite(): 'fresh' | 'versioned' | 'legacy' | 'unrecognized' {
  if (!existsSync(sqlitePath)) return 'fresh'

  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    const tables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
        .map(row => row.name),
    )
    const applicationTables = [...tables].filter(name => !name.startsWith('sqlite_') && name !== '__drizzle_migrations')
    if (applicationTables.length === 0) return 'fresh'

    const hasMigrationMetadata = tables.has('__drizzle_migrations')
    const hasFieldPerformanceTests = tables.has('field_performance_tests')
    const fieldPerformanceColumns = hasFieldPerformanceTests
      ? new Set(
          (sqlite.prepare('PRAGMA table_info(field_performance_tests)').all() as { name: string }[])
            .map(row => row.name),
        )
      : new Set<string>()

    if (hasMigrationMetadata && hasFieldPerformanceTests && !fieldPerformanceColumns.has('recorded_by_user_id')) {
      throw new Error(
        'SQLite state is inconsistent: versioned migration metadata exists but field_performance_tests.recorded_by_user_id is missing; reject automatic migration and use the documented recovery path',
      )
    }

    if (hasMigrationMetadata && tables.has('microcycle_intensity_targets')) {
      const intensityColumns = new Set(
        (sqlite.prepare('PRAGMA table_info(microcycle_intensity_targets)').all() as { name: string }[])
          .map(row => row.name),
      )
      if (
        !intensityColumns.has('reference_percentage_target') ||
        intensityColumns.has('pam_percentage_target')
      ) {
        throw new Error(
          'SQLite state is inconsistent: microcycle_intensity_targets.reference_percentage_target is missing or legacy pam_percentage_target remains; refusing automatic migration without an explicitly approved test-data reset',
        )
      }
    }

    if (hasMigrationMetadata) {
      const billingTables = [
        'team_economic_policies',
        'athlete_billing_terms',
        'monthly_charges',
      ]
      const presentBillingTables = billingTables.filter(table => tables.has(table))
      if (
        presentBillingTables.length > 0
        && presentBillingTables.length !== billingTables.length
      ) {
        throw new Error(
          'SQLite billing schema is inconsistent: H1 billing tables are only partially present; refusing automatic migration until the database is restored to a recognized versioned state',
        )
      }

      return 'versioned'
    }

    const reviewedLegacyTables = ['workout_logs', 'group_training_plans', 'macrocycles']
    const isReviewedLegacy = reviewedLegacyTables.every(table => tables.has(table))
    return isReviewedLegacy ? 'legacy' : 'unrecognized'
  } finally {
    sqlite.close()
  }
}

function assertCompatiblePrescriptionPlanningScopes(sqlite: Database.Database): void {
  const tables = new Set(
    (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
      .map(row => row.name),
  )
  if (!tables.has('group_session_prescriptions')) return

  const duplicate = sqlite.prepare(`
    SELECT session_id, microcycle_id, COUNT(*) AS count
    FROM group_session_prescriptions
    GROUP BY session_id, microcycle_id
    HAVING COUNT(*) > 1
    LIMIT 1
  `).get() as { session_id: string; microcycle_id: string; count: number } | undefined

  if (duplicate) {
    throw new Error(
      `SQLite prescription planning scope is incompatible: duplicate Session + microcycle rows exist for session ${duplicate.session_id}, microcycle ${duplicate.microcycle_id}; refusing automatic migration because reconciliation requires an explicit product/data decision`,
    )
  }
}

function establishCanonicalMigrationMetadata(
  sqlite: Database.Database,
  appliedThroughTag?: string,
): void {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)`)

  const journal = JSON.parse(
    readFileSync(resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string; when: number }> }
  const appliedCount =
    appliedThroughTag === undefined
      ? journal.entries.length
      : journal.entries.findIndex(entry => entry.tag === appliedThroughTag) + 1

  if (appliedThroughTag !== undefined && appliedCount === 0) {
    throw new Error(`SQLite migration journal is missing canonical tag ${appliedThroughTag}`)
  }

  const existing = sqlite.prepare(
    'SELECT hash FROM __drizzle_migrations WHERE created_at = ?',
  )
  const insert = sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')

  for (const entry of journal.entries.slice(0, appliedCount)) {
    const migrationPath = resolve(projectRoot, 'drizzle/sqlite', `${entry.tag}.sql`)
    const sql = readFileSync(migrationPath, 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')
    const row = existing.get(entry.when) as { hash: string } | undefined
    if (row) {
      if (row.hash !== hash) {
        throw new Error(
          `SQLite migration metadata conflict at canonical timestamp ${entry.when}`,
        )
      }
      continue
    }

    insert.run(hash, entry.when)
  }
}

function repairFalselyReconciledBillingH2Metadata(): void {
  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    const tables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
        .map(row => row.name),
    )
    const h2Tables = [
      'global_monthly_due_date_exceptions',
      'monthly_charge_reductions',
      'monthly_charge_extensions',
    ]
    const presentH2Tables = h2Tables.filter(table => tables.has(table))

    if (presentH2Tables.length === h2Tables.length) return
    if (presentH2Tables.length > 0) {
      throw new Error(
        'SQLite billing H2 schema is inconsistent: H2 tables are only partially present; refusing automatic metadata repair',
      )
    }

    const h1Tables = [
      'team_economic_policies',
      'athlete_billing_terms',
      'monthly_charges',
    ]
    if (!h1Tables.every(table => tables.has(table))) return

    const journal = JSON.parse(
      readFileSync(resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string; when: number }> }
    const firstH2Index = journal.entries.findIndex(
      entry => entry.tag === '0009_membership_global_due_date_exceptions',
    )
    if (firstH2Index < 0) {
      throw new Error('SQLite migration journal is missing canonical H2 billing migration 0009')
    }

    const h2Timestamps = journal.entries.slice(firstH2Index).map(entry => entry.when)
    const deleteMigration = sqlite.prepare('DELETE FROM __drizzle_migrations WHERE created_at = ?')

    sqlite.transaction(() => {
      for (const timestamp of h2Timestamps) deleteMigration.run(timestamp)
    })()
  } finally {
    sqlite.close()
  }
}

function repairFalselyReconciledH1Metadata(): void {
  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    const tables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
        .map(row => row.name),
    )

    const h1Tables = [
      'external_identity_links',
      'team_memberships',
    ]
    const presentH1Tables = h1Tables.filter(table => tables.has(table))

    if (presentH1Tables.length === h1Tables.length) return
    if (presentH1Tables.length > 0) {
      throw new Error(
        'SQLite H1 identity schema is inconsistent: H1 tables are only partially present; refusing automatic metadata repair',
      )
    }

    const journal = JSON.parse(
      readFileSync(resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string; when: number }> }

    const externalIdentityEntry = journal.entries.find(
      entry => entry.tag === '0017_natural_fabian_cortez',
    )
    const teamMembershipEntry = journal.entries.find(
      entry => entry.tag === '0018_daily_aqueduct',
    )

    if (!externalIdentityEntry || !teamMembershipEntry) {
      throw new Error(
        'SQLite migration journal is missing canonical H1 identity migrations 0017/0018',
      )
    }

    const deleteMigration = sqlite.prepare(
      'DELETE FROM __drizzle_migrations WHERE created_at = ?',
    )

    sqlite.transaction(() => {
      deleteMigration.run(externalIdentityEntry.when)
      deleteMigration.run(teamMembershipEntry.when)
    })()
  } finally {
    sqlite.close()
  }
}

function reconcileVersionedHeadMetadata(): boolean {
  const verification = spawnSync(process.execPath, [tsxCli, resolve(projectRoot, 'scripts/verify-sqlite.ts')], {
    stdio: 'ignore',
  })
  if (verification.status !== 0) return false

  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    sqlite.transaction(() => {
      establishCanonicalMigrationMetadata(sqlite)
    })()
  } finally {
    sqlite.close()
  }

  return true
}

const state = classifyExistingSqlite()

if (state === "versioned") {
  const sqlite = new Database(sqlitePath, { fileMustExist: true })

  try {
    const columns = sqlite.pragma(
      'table_info(athlete_profiles)'
    ) as Array<{ name: string; notnull: number }>

    const userId = columns.find(column =>
      column.name === 'user_id'
    )

    const expectedNewColumns = [
      'first_name',
      'last_name',
      'contact_email',
    ]

    const requiresIdentityUpgrade =
      !userId ||
      userId.notnull !== 0 ||
      expectedNewColumns.some(name =>
        !columns.some(column => column.name === name)
      )

    if (requiresIdentityUpgrade) {
      // The dedicated preflight determines whether the
      // complete 0015 origin is legitimate.
      // Unexpected metadata must not bypass this gate.
      migrateAthleteProfileIdentitySqlite(sqlite)
    } else {
      // A physically upgraded AthleteProfile must already have
      // its complete, canonical 0016 history. Never repair it.
      const journal = JSON.parse(
        readFileSync(
          resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'),
          'utf8',
        ),
      ) as {
        entries: Array<{ idx: number; tag: string; when: number }>
      }

      if (
        journal.entries[16]?.idx !== 16 ||
        journal.entries[16]?.tag !== '0016_athlete_profile_identity' ||
        journal.entries[16]?.when !== 1790802001000
      ) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: canonical journal',
        )
      }

      // A migrated 0016 database must retain one of the two
      // historically authorized physical metadata formats.
      const metadataDefinition = sqlite.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
      ).get() as { sql: string } | undefined

      const normalizeMetadataDdl = (value: string) =>
        value
          .replace(/"/g, '')
          .replace(/\s+/g, ' ')
          .replace(/\s*([(),])\s*/g, '$1')
          .trim()
          .toUpperCase()

      const actualMetadataDdl = metadataDefinition?.sql
        ? normalizeMetadataDdl(metadataDefinition.sql)
        : null

      const serialMetadataDdl = normalizeMetadataDdl(
        'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)',
      )

      const integerMetadataDdl = normalizeMetadataDdl(
        'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)',
      )

      const metadataFormat =
        actualMetadataDdl === serialMetadataDdl ? 'serial'
        : actualMetadataDdl === integerMetadataDdl ? 'integer'
        : null

      if (!metadataFormat) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: metadata structure',
        )
      }

      const metadataColumns = sqlite.pragma(
        'table_xinfo(__drizzle_migrations)',
      ) as Array<{
        name: string
        type: string
        notnull: number
        dflt_value: string | null
        pk: number
        hidden: number
      }>

      const expectedMetadataColumns = [
        [
          'id',
          metadataFormat === 'serial' ? 'SERIAL' : 'INTEGER',
          0, null, 1, 0,
        ],
        ['hash', 'TEXT', 1, null, 0, 0],
        ['created_at', 'NUMERIC', 0, null, 0, 0],
      ]

      const actualMetadataColumns = metadataColumns.map(column => [
        column.name,
        column.type.toUpperCase(),
        column.notnull,
        column.dflt_value,
        column.pk,
        column.hidden,
      ])

      if (
        JSON.stringify(actualMetadataColumns) !==
        JSON.stringify(expectedMetadataColumns)
      ) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: metadata structure',
        )
      }

      const metadataIndexes = sqlite.pragma(
        'index_list(__drizzle_migrations)',
      ) as Array<{
        name: string
        unique: number
        origin: string
        partial: number
      }>

      const validMetadataIndexes =
        metadataFormat === 'serial'
          ? metadataIndexes.length === 1 &&
            metadataIndexes[0].name ===
              'sqlite_autoindex___drizzle_migrations_1' &&
            metadataIndexes[0].unique === 1 &&
            metadataIndexes[0].origin === 'pk' &&
            metadataIndexes[0].partial === 0
          : metadataIndexes.length === 0

      if (!validMetadataIndexes) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: metadata structure',
        )
      }

      const metadataIdentifiers = sqlite.prepare(
        'SELECT id FROM __drizzle_migrations ORDER BY rowid',
      ).all() as Array<{ id: number | null }>

      const hasInvalidIntegerIdentifiers =
        metadataFormat === 'integer' &&
        metadataIdentifiers.some((record, index) =>
          !Number.isSafeInteger(record.id) ||
          Number(record.id) <= 0 ||
          (
            index > 0 &&
            Number(record.id) <= Number(metadataIdentifiers[index - 1]?.id)
          )
        )

      if (
        metadataIdentifiers.length < 17 ||
        metadataIdentifiers.length > journal.entries.length ||
        (
          metadataFormat === 'serial'
            ? metadataIdentifiers.some(record => record.id !== null)
            : hasInvalidIntegerIdentifiers
        )
      ) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: metadata identifiers',
        )
      }

      const expected = journal.entries
        .slice(0, metadataIdentifiers.length)
        .map(entry => {
          const migrationSql = readFileSync(
            resolve(projectRoot, 'drizzle/sqlite', entry.tag + '.sql'),
            'utf8',
          )
          const rawHash = createHash('sha256')
            .update(migrationSql)
            .digest('hex')
          const canonicalHash =
            entry.tag === '0016_athlete_profile_identity'
              ? createHash('sha256')
                  .update(migrationSql.replace(/\r\n/g, '\n'))
                  .digest('hex')
              : rawHash

          return {
            rawHash,
            canonicalHash,
            created_at: entry.when,
          }
        })

      const actual = sqlite.prepare(
        'SELECT hash, created_at FROM __drizzle_migrations ORDER BY rowid',
      ).all() as Array<{ hash: string; created_at: number }>

      const hasMigrationHistoryDrift = actual.some((record, index) => {
        const canonical = expected[index]
        if (!canonical || record.created_at !== canonical.created_at) return true

        return (
          record.hash !== canonical.rawHash &&
          record.hash !== canonical.canonicalHash
        )
      })

      if (hasMigrationHistoryDrift) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: migration history',
        )
      }

      // Exact physical contract produced by the dedicated 0016 executor.
      // Reject any extra, missing or altered column without repairing it.
      const expectedColumns = [
        ['id', 'TEXT', 1, 1, null],
        ['is_deleted', 'INTEGER', 1, 0, 'false'],
        ['created_at', 'TEXT', 1, 0, null],
        ['updated_at', 'TEXT', 1, 0, null],
        ['user_id', 'TEXT', 0, 0, null],
        ['team_id', 'TEXT', 1, 0, null],
        ['group_id', 'TEXT', 0, 0, null],
        ['is_active', 'INTEGER', 1, 0, 'true'],
        ['first_name', 'TEXT', 0, 0, null],
        ['last_name', 'TEXT', 0, 0, null],
        ['contact_email', 'TEXT', 0, 0, null],
        ['nick_name', 'TEXT', 0, 0, null],
        ['dni', 'TEXT', 1, 0, null],
        ['birthday', 'TEXT', 0, 0, null],
        ['phone', 'TEXT', 0, 0, null],
        ['emergency_contact', 'TEXT', 0, 0, null],
        ['emergency_phone', 'TEXT', 0, 0, null],
        ['physiology', 'TEXT', 0, 0, null],
        ['medical', 'TEXT', 0, 0, null],
      ]

      const physicalColumns = sqlite.pragma(
        'table_info(athlete_profiles)',
      ) as Array<{
        name: string
        type: string
        notnull: number
        pk: number
        dflt_value: string | null
      }>

      const actualColumns = physicalColumns.map(column => [
        column.name,
        column.type.toUpperCase(),
        column.notnull,
        column.pk,
        column.dflt_value === null
          ? null
          : column.dflt_value.trim().toLowerCase(),
      ])

      if (
        JSON.stringify(actualColumns) !==
        JSON.stringify(expectedColumns)
      ) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: columns',
        )
      }

      const expectedForeignKeys = [
        ['group_id', 'athlete_groups', 'id', 'SET NULL', 'NO ACTION'],
        ['team_id', 'teams', 'id', 'CASCADE', 'NO ACTION'],
        ['user_id', 'users', 'id', 'RESTRICT', 'NO ACTION'],
      ]

      const physicalForeignKeys = sqlite.pragma(
        'foreign_key_list(athlete_profiles)',
      ) as Array<{
        id: number
        seq: number
        table: string
        from: string
        to: string
        on_delete: string
        on_update: string
      }>

      const actualForeignKeys = physicalForeignKeys.map(fk => [
        fk.from,
        fk.table,
        fk.to,
        fk.on_delete.toUpperCase(),
        fk.on_update.toUpperCase(),
      ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))

      if (
        physicalForeignKeys.some(fk => fk.seq !== 0) ||
        JSON.stringify(actualForeignKeys) !==
          JSON.stringify(expectedForeignKeys)
      ) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: foreign keys',
        )
      }

      const indexes = sqlite.pragma(
        'index_list(athlete_profiles)',
      ) as Array<{
        name: string
        unique: number
        origin: string
        partial: number
      }>

      const secondary = indexes.filter(index =>
        index.origin !== 'pk'
      )

      const identityIndex = secondary[0]

      if (
        secondary.length !== 1 ||
        identityIndex?.name !== 'athlete_profiles_user_team_unique' ||
        identityIndex.unique !== 1 ||
        identityIndex.origin !== 'c' ||
        identityIndex.partial !== 0
      ) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: unique index',
        )
      }

      const indexedColumns = sqlite.pragma(
        'index_info("athlete_profiles_user_team_unique")',
      ) as Array<{ name: string }>

      if (
        JSON.stringify(indexedColumns.map(column => column.name)) !==
        JSON.stringify(['user_id', 'team_id'])
      ) {
        throw new Error(
          'AthleteProfile incompatible applied 0016: index columns',
        )
      }
    }
  } finally {
    sqlite.close()
  }
}

if (state !== 'fresh') {
  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    assertCompatiblePrescriptionPlanningScopes(sqlite)
  } finally {
    sqlite.close()
  }
}
if (state === 'versioned') {
  repairFalselyReconciledBillingH2Metadata()
  repairFalselyReconciledH1Metadata()
}
if (state === 'unrecognized') {
  throw new Error(
    'Unrecognized SQLite schema; refusing automatic migration before destructive mutation',
  )
}

if (state === 'fresh') {
  runDrizzleKit([
    'push',
    `--config=${resolve(import.meta.dirname, '../drizzle.sqlite.config.ts')}`,
  ])

  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    // Drizzle push creates tables and indexes but does not create the
    // cohort association triggers installed by the supported legacy upgrade.
    migratePlanningCohortsSqlite(sqlite)
    establishCanonicalMigrationMetadata(sqlite)
  } finally {
    sqlite.close()
  }

  runNode([tsxCli, resolve(projectRoot, 'scripts/verify-sqlite.ts')])
  process.exit(0)
}

if (state === 'versioned' && reconcileVersionedHeadMetadata()) {
  runNode([tsxCli, resolve(projectRoot, 'scripts/verify-sqlite.ts')])
  process.exit(0)
}

if (state === 'legacy') {
  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    migrateRealizedTrainingTimingSqlite(sqlite)

    sqlite.transaction(() => {
      migratePlanningCohortsSqlite(sqlite)
      migrateCompetitionEntriesSqlite(sqlite)
      migrateMacrocycleTargetRaceDateSqlite(sqlite)
      establishCanonicalMigrationMetadata(sqlite, '0001_realized_training_timing')

      if ((sqlite.pragma('foreign_key_check') as unknown[]).length > 0) {
        throw new Error('Legacy SQLite reconciliation failed foreign-key verification')
      }
    })()
  } finally {
    sqlite.close()
  }

  const canonical = new Database(sqlitePath, { fileMustExist: true })
  try {
    canonical.pragma('foreign_keys = ON')

    // The RED path already proved that canonical 0002-0015 migrations are
    // applicable to this reconciled legacy origin. Bound Drizzle at 0015,
    // then let the single KAN-615 executor own the protected 0016 transition.
    migrateLegacyCanonicalHistoryThrough0015(canonical)
    migrateAthleteProfileIdentitySqlite(canonical)

    if ((canonical.pragma('foreign_key_check') as unknown[]).length > 0) {
      throw new Error('Legacy SQLite KAN-615 migration failed foreign-key verification')
    }
  } finally {
    canonical.close()
  }
}

runDrizzleKit([
  'migrate',
  `--config=${resolve(import.meta.dirname, '../drizzle.sqlite.config.ts')}`,
])
runNode([tsxCli, resolve(projectRoot, 'scripts/verify-sqlite.ts')])
