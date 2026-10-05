import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'

/**
 * Validates the connection-level prerequisites for the bounded
 * KAN-615 AthleteProfile SQLite upgrade.
 *
 * This function does not mutate the database or establish
 * exclusive ownership of the connection.
 */
export function assertAthleteProfileUpgradePreconditions(
  sqlite: Database.Database,
): void {
  if (sqlite.inTransaction) {
    throw new Error(
      'AthleteProfile upgrade precondition failed: active transaction',
    )
  }

  const foreignKeys = sqlite.pragma('foreign_keys', {
    simple: true,
  })

  if (foreignKeys !== 1) {
    throw new Error(
      'AthleteProfile upgrade precondition failed: foreign keys must be enabled',
    )
  }
}

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '../..')

type HistoricalColumn = {
  type: string
  primaryKey: boolean
  notNull: boolean
  default?: unknown
}

type HistoricalForeignKey = {
  tableTo: string
  columnsFrom: string[]
  columnsTo: string[]
  onDelete: string
  onUpdate: string
}

type SqliteColumn = {
  name: string
  type: string
  notnull: number
  pk: number
  dflt_value: string | null
}

function canonicalDefault(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (value === true || value === 'true' || value === 1 || value === '1') return '1'
  if (value === false || value === 'false' || value === 0 || value === '0') return '0'
  return String(value).replace(/^\((.*)\)$/, '$1').toLowerCase()
}

function canonicalSqliteDefault(value: string | null): string | null {
  if (value === null) return null
  const normalized = value.replace(/^\((.*)\)$/, '$1').toLowerCase()
  if (normalized === 'true') return '1'
  if (normalized === 'false') return '0'
  return normalized
}

/**
 * Read-only validation of the original athlete_profiles table shape.
 * Whole-database references and migration metadata are separate gates.
 */
export function assertAthleteProfileHistoricalStructureSqlite(
  sqlite: Database.Database,
): void {
  assertAthleteProfileUpgradePreconditions(sqlite)

  const snapshot = JSON.parse(
    readFileSync(
      resolve(projectRoot, 'drizzle/sqlite/meta/0015_snapshot.json'),
      'utf8',
    ),
  ) as {
    tables: Record<string, {
      columns: Record<string, HistoricalColumn>
      indexes: Record<string, { columns: string[]; isUnique: boolean }>
      foreignKeys: Record<string, HistoricalForeignKey>
    }>
  }

  const expected = snapshot.tables.athlete_profiles
  if (!expected) throw new Error('AthleteProfile historical schema missing')

  const actualColumns = sqlite.pragma('table_info(athlete_profiles)') as SqliteColumn[]

  if (actualColumns.length !== Object.keys(expected.columns).length) {
    throw new Error('AthleteProfile incompatible column structure')
  }

  for (const actual of actualColumns) {
    const column = expected.columns[actual.name]
    if (
      !column ||
      actual.type.toLowerCase() !== column.type.toLowerCase() ||
      Boolean(actual.pk) !== column.primaryKey ||
      Boolean(actual.notnull) !== column.notNull ||
      canonicalSqliteDefault(actual.dflt_value) !== canonicalDefault(column.default)
    ) {
      throw new Error(`AthleteProfile incompatible column structure: ${actual.name}`)
    }
  }

  const actualIndexes = sqlite.pragma('index_list(athlete_profiles)') as Array<{
    name: string
    unique: number
    origin: string
  }>

  const namedIndexes = actualIndexes.filter(index => index.origin !== 'pk')
  if (namedIndexes.length !== Object.keys(expected.indexes).length) {
    throw new Error('AthleteProfile incompatible index structure')
  }

  for (const index of namedIndexes) {
    const declared = expected.indexes[index.name]
    const columns = (sqlite.pragma(`index_info("${index.name}")`) as Array<{
      name: string
    }>).map(item => item.name)

    if (
      !declared ||
      Boolean(index.unique) !== declared.isUnique ||
      JSON.stringify(columns) !== JSON.stringify(declared.columns)
    ) {
      throw new Error(`AthleteProfile incompatible index: ${index.name}`)
    }
  }

  const actualForeignKeys = sqlite.pragma(
    'foreign_key_list(athlete_profiles)',
  ) as Array<{
    table: string
    from: string
    to: string
    on_delete: string
    on_update: string
  }>

  const expectedForeignKeys = Object.values(expected.foreignKeys)

  if (actualForeignKeys.length !== expectedForeignKeys.length) {
    throw new Error('AthleteProfile incompatible foreign key structure')
  }

  for (const fk of expectedForeignKeys) {
    const match = actualForeignKeys.filter(actual =>
      actual.table === fk.tableTo &&
      actual.from === fk.columnsFrom[0] &&
      actual.to === fk.columnsTo[0] &&
      actual.on_delete.toLowerCase() === fk.onDelete.toLowerCase() &&
      actual.on_update.toLowerCase() === fk.onUpdate.toLowerCase()
    )

    if (match.length !== 1) {
      throw new Error('AthleteProfile incompatible foreign key structure')
    }
  }
}

type IncomingReference = {
  source: string
  target: string
  from: string[]
  to: string[]
  onDelete: string
  onUpdate: string
}

type SqliteReferenceRow = {
  id: number
  seq: number
  table: string
  from: string
  to: string
  on_delete: string
  on_update: string
}

function normalizeIncomingReference(
  reference: IncomingReference,
): string {
  return JSON.stringify({
    source: reference.source,
    target: reference.target,
    from: reference.from,
    to: reference.to,
    onDelete: reference.onDelete.toLowerCase(),
    onUpdate: reference.onUpdate.toLowerCase(),
  })
}

/**
 * Validates every incoming AthleteProfile foreign key against
 * the historical 0015 snapshot, including references from
 * unexpected tables.
 *
 * No DDL, DML or PRAGMA mutation is performed.
 */
export function assertAthleteProfileIncomingReferencesSqlite(
  sqlite: Database.Database,
): void {
  assertAthleteProfileUpgradePreconditions(sqlite)

  const snapshot = JSON.parse(
    readFileSync(
      resolve(projectRoot, 'drizzle/sqlite/meta/0015_snapshot.json'),
      'utf8',
    ),
  ) as {
    tables: Record<string, {
      foreignKeys?: Record<string, {
        tableTo: string
        columnsFrom: string[]
        columnsTo: string[]
        onDelete: string
        onUpdate: string
      }>
    }>
  }

  const expected: IncomingReference[] = []

  for (const [source, definition] of Object.entries(snapshot.tables)) {
    for (const fk of Object.values(definition.foreignKeys ?? {})) {
      if (fk.tableTo !== 'athlete_profiles') continue

      expected.push({
        source,
        target: fk.tableTo,
        from: fk.columnsFrom,
        to: fk.columnsTo,
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      })
    }
  }

  if (expected.length !== 12) {
    throw new Error(
      'AthleteProfile incompatible historical reference inventory',
    )
  }

  const tables = sqlite.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>

  const actual: IncomingReference[] = []

  for (const { name } of tables) {
    const escapedName = name.replace(/"/g, '""')

    const rows = sqlite.pragma(
      `foreign_key_list("${escapedName}")`,
    ) as SqliteReferenceRow[]

    const grouped = new Map<number, SqliteReferenceRow[]>()

    for (const row of rows) {
      if (row.table !== 'athlete_profiles') continue

      const group = grouped.get(row.id) ?? []
      group.push(row)
      grouped.set(row.id, group)
    }

    for (const group of grouped.values()) {
      group.sort((a, b) => a.seq - b.seq)

      actual.push({
        source: name,
        target: 'athlete_profiles',
        from: group.map(row => row.from),
        to: group.map(row => row.to),
        onDelete: group[0].on_delete,
        onUpdate: group[0].on_update,
      })
    }
  }

  const expectedKeys = expected
    .map(normalizeIncomingReference)
    .sort()

  const actualKeys = actual
    .map(normalizeIncomingReference)
    .sort()

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      'AthleteProfile incompatible incoming foreign key structure',
    )
  }
}

type CanonicalMigrationEntry = {
  tag: string
  when: number
}

type RecordedMigration = {
  id: number
  hash: string
  created_at: number
}

/**
 * Read-only validation of the exact canonical history through 0015.
 *
 * This is a prerequisite, not a migration runner or a metadata repair.
 */
export function assertAthleteProfileMigrationHistorySqlite(
  sqlite: Database.Database,
): void {
  assertAthleteProfileUpgradePreconditions(sqlite)

  const definition = sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type = ? AND name = ?",
  ).get("table", "__drizzle_migrations") as
    | { sql: string }
    | undefined

  if (!definition?.sql) {
    throw new Error("AthleteProfile incompatible migration metadata structure")
  }

  const normalizeDdl = (ddl: string): string =>
    ddl
      .replace(/"/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([(),])\s*/g, "$1")
      .trim()
      .toUpperCase()

  const ddl = normalizeDdl(definition.sql)

  const serialDdl = normalizeDdl(
    "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)",
  )
  const integerDdl = normalizeDdl(
    "CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)",
  )

  const format =
    ddl === serialDdl ? "serial"
    : ddl === integerDdl ? "integer"
    : null

  if (!format) {
    throw new Error("AthleteProfile incompatible migration metadata structure")
  }

  const columns = sqlite.pragma(
    "table_xinfo(__drizzle_migrations)",
  ) as Array<{
    name: string
    type: string
    notnull: number
    dflt_value: string | null
    pk: number
    hidden: number
  }>

  const expectedColumns = [
    { name: "id", type: format === "serial" ? "SERIAL" : "INTEGER", notnull: 0, dflt_value: null, pk: 1, hidden: 0 },
    { name: "hash", type: "TEXT", notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
    { name: "created_at", type: "NUMERIC", notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
  ]

  if (
    JSON.stringify(columns.map(column => ({
      name: column.name,
      type: column.type.toUpperCase(),
      notnull: column.notnull,
      dflt_value: column.dflt_value,
      pk: column.pk,
      hidden: column.hidden,
    }))) !== JSON.stringify(expectedColumns)
  ) {
    throw new Error("AthleteProfile incompatible migration metadata columns")
  }

  const indexes = sqlite.pragma(
    "index_list(__drizzle_migrations)",
  ) as Array<{
    name: string
    unique: number
    origin: string
    partial: number
  }>

  if (format === "serial") {
    if (
      indexes.length !== 1 ||
      indexes[0].name !== "sqlite_autoindex___drizzle_migrations_1" ||
      indexes[0].unique !== 1 ||
      indexes[0].origin !== "pk" ||
      indexes[0].partial !== 0
    ) {
      throw new Error("AthleteProfile incompatible SERIAL metadata index")
    }
  } else if (indexes.length !== 0) {
    throw new Error("AthleteProfile incompatible INTEGER metadata index")
  }

  const journal = JSON.parse(
    readFileSync(
      resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'),
      'utf8',
    ),
  ) as { entries: CanonicalMigrationEntry[] }

  const headIndex = journal.entries.findIndex(
    entry => entry.tag.startsWith('0015_'),
  )

if (headIndex < 0) {
    throw new Error('AthleteProfile canonical migration head missing')
  }

  const expected = journal.entries.slice(0, headIndex + 1)
    .map(entry => {
      const sql = readFileSync(
        resolve(projectRoot, 'drizzle/sqlite', `${entry.tag}.sql`),
        'utf8',
      )

      return {
        created_at: entry.when,
        hash: createHash('sha256').update(sql).digest('hex'),
      }
    })

  const actual = sqlite.prepare(`
    SELECT id, hash, created_at
    FROM __drizzle_migrations
    ORDER BY rowid
  `).all() as RecordedMigration[]

  if (actual.length !== expected.length) {
    throw new Error(
      'AthleteProfile incompatible migration history length',
    )
  }

  const actualTimestamps = new Set<number>()

  for (let index = 0; index < expected.length; index++) {
    const row = actual[index]
    const canonical = expected[index]

    if (
      (format === "serial" && row.id !== null) ||
      (format === "integer" && (
        !Number.isSafeInteger(row.id) ||
        row.id !== index + 1
      ))
    ) {
      throw new Error(
        "AthleteProfile incompatible migration metadata identifiers",
      )
    }

    if (
      !Number.isSafeInteger(row.created_at) ||
      actualTimestamps.has(row.created_at) ||
      row.created_at !== canonical.created_at ||
      row.hash !== canonical.hash
    ) {
      throw new Error(
        `AthleteProfile migration metadata drift at entry ${index}`,
      )
    }

    actualTimestamps.add(row.created_at)
  }
}

/**
 * Rejects a physically inconsistent AthleteProfile versioned origin.
 *
 * Read-only. Does not repair metadata, toggle PRAGMAs,
 * create tables or initiate a migration.
 */
export function assertAthleteProfileVersionedOriginSqlite(
  sqlite: Database.Database,
): void {
  assertAthleteProfileUpgradePreconditions(sqlite)

  const checks = [
    assertAthleteProfileMigrationHistorySqlite,
    assertAthleteProfileHistoricalStructureSqlite,
    assertAthleteProfileIncomingReferencesSqlite,
  ]

  for (const check of checks) {
    try {
      check(sqlite)
    } catch (error) {
      if (
        error instanceof Error &&
        !(error instanceof TypeError) &&
        error.message.startsWith('AthleteProfile ')
      ) {
        throw new Error(
          `AthleteProfile incompatible versioned origin: ${error.message}`,
          { cause: error },
        )
      }

      throw error
    }
  }
}

type AthleteIdentityFailurePoint = 'afterCopy' | 'beforeMetadata'

export function migrateAthleteProfileIdentitySqlite(
  sqlite: Database.Database,
  options: { failAt?: AthleteIdentityFailurePoint } = {},
): void {
  // All physical and metadata preflights run before FK configuration changes.
  assertAthleteProfileVersionedOriginSqlite(sqlite)

  // A reserved reconstruction artifact indicates a noncanonical
  // partial state. Never overwrite or remove it automatically.
  const partialArtifact = sqlite.prepare(
    "SELECT type FROM sqlite_master WHERE name = ?",
  ).get('__new_athlete_profiles') as
    | { type: string }
    | undefined

  if (partialArtifact) {
    throw new Error(
      'AthleteProfile incompatible partial reconstruction: ' +
      '__new_athlete_profiles already exists',
    )
  }

  const journal = JSON.parse(
    readFileSync(
      resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'),
      'utf8',
    ),
  ) as {
    entries: Array<{ idx: number; tag: string; when: number }>
  }

  const entry = journal.entries[16]
  if (
    entry?.idx !== 16 ||
    entry.tag !== '0016_athlete_profile_identity' ||
    entry.when !== 1790802001000
  ) {
    throw new Error('AthleteProfile incompatible canonical 0016 journal')
  }

  const migrationSql = readFileSync(
    resolve(projectRoot, `drizzle/sqlite/${entry.tag}.sql`),
    'utf8',
  )

  if (
    migrationSql.trim() !==
    'SELECT * FROM "__kan615_dedicated_executor_required__";'
  ) {
    throw new Error('AthleteProfile incompatible canonical 0016 guard')
  }

  const migrationHash = createHash('sha256')
    .update(migrationSql)
    .digest('hex')

  const relatedTables = [
    'athlete_billing_terms',
    'athlete_session_adjustments',
    'field_performance_tests',
    'group_history_records',
    'memberships',
    'monthly_charges',
    'physiology_records',
    'planning_cohort_memberships',
    'readiness_evaluations',
    'shoes',
    'training_goals',
    'workout_logs',
  ] as const

  const snapshotReferences = () =>
    relatedTables.map(table => ({
      table,
      rows: sqlite.prepare(
        `SELECT * FROM "${table}" ORDER BY rowid`,
      ).all(),
    }))

  const beforeReferences = snapshotReferences()

  const beforeAthletes = (
    sqlite.prepare('SELECT COUNT(*) AS count FROM athlete_profiles')
      .get() as { count: number }
  ).count

  // FK toggles are never issued inside a SQLite transaction.
  sqlite.pragma('foreign_keys = OFF')

  try {
    sqlite.exec('BEGIN EXCLUSIVE')

    try {
      sqlite.exec(`
        CREATE TABLE "__new_athlete_profiles" (
          "id" text PRIMARY KEY NOT NULL,
          "is_deleted" integer DEFAULT false NOT NULL,
          "created_at" text NOT NULL,
          "updated_at" text NOT NULL,
          "user_id" text,
          "team_id" text NOT NULL,
          "group_id" text,
          "is_active" integer DEFAULT true NOT NULL,
          "first_name" text,
          "last_name" text,
          "contact_email" text,
          "nick_name" text,
          "dni" text NOT NULL,
          "birthday" text,
          "phone" text,
          "emergency_contact" text,
          "emergency_phone" text,
          "physiology" text,
          "medical" text,
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON UPDATE no action ON DELETE restrict,
          FOREIGN KEY ("team_id") REFERENCES "teams"("id")
            ON UPDATE no action ON DELETE cascade,
          FOREIGN KEY ("group_id") REFERENCES "athlete_groups"("id")
            ON UPDATE no action ON DELETE set null
        );

        INSERT INTO "__new_athlete_profiles" (
          id, is_deleted, created_at, updated_at,
          user_id, team_id, group_id, is_active,
          first_name, last_name, contact_email,
          nick_name, dni, birthday, phone,
          emergency_contact, emergency_phone,
          physiology, medical
        )
        SELECT
          a.id, a.is_deleted, a.created_at, a.updated_at,
          a.user_id, a.team_id, a.group_id, a.is_active,
          u.first_name, u.last_name, u.email,
          a.nick_name, a.dni, a.birthday, a.phone,
          a.emergency_contact, a.emergency_phone,
          a.physiology, a.medical
        FROM athlete_profiles AS a
        LEFT JOIN users AS u ON u.id = a.user_id;
      `)

      if (options.failAt === 'afterCopy') {
        throw new Error('KAN615_INJECTED_afterCopy')
      }

      sqlite.exec(`
        DROP TABLE "athlete_profiles";
        ALTER TABLE "__new_athlete_profiles"
          RENAME TO "athlete_profiles";
        CREATE UNIQUE INDEX "athlete_profiles_user_team_unique"
          ON "athlete_profiles" ("user_id", "team_id");
      `)

      const afterAthletes = (
        sqlite.prepare(
          'SELECT COUNT(*) AS count FROM athlete_profiles',
        ).get() as { count: number }
      ).count

      if (afterAthletes !== beforeAthletes) {
        throw new Error('AthleteProfile athlete count drift')
      }

      if (
        JSON.stringify(snapshotReferences()) !==
        JSON.stringify(beforeReferences)
      ) {
        throw new Error('AthleteProfile dependent records drift')
      }

      const columns = sqlite.pragma(
        'table_info(athlete_profiles)',
      ) as Array<{ name: string; notnull: number }>

      if (
        columns.find(column => column.name === 'user_id')?.notnull !== 0 ||
        !['first_name', 'last_name', 'contact_email'].every(name =>
          columns.some(column => column.name === name)
        )
      ) {
        throw new Error('AthleteProfile destination structure mismatch')
      }

      const foreignKeys = sqlite.pragma(
        'foreign_key_list(athlete_profiles)',
      ) as Array<{
        table: string
        from: string
        on_delete: string
      }>

      if (!foreignKeys.some(fk =>
        fk.table === 'users' &&
        fk.from === 'user_id' &&
        fk.on_delete.toUpperCase() === 'RESTRICT'
      )) {
        throw new Error('AthleteProfile destination user FK mismatch')
      }

      if ((sqlite.pragma('foreign_key_check') as unknown[]).length !== 0) {
        throw new Error('AthleteProfile foreign key integrity failure')
      }

      if (options.failAt === 'beforeMetadata') {
        throw new Error('KAN615_INJECTED_beforeMetadata')
      }

      sqlite.prepare(`
        INSERT INTO __drizzle_migrations (hash, created_at)
        VALUES (?, ?)
      `).run(migrationHash, entry.when)

      const latest = sqlite.prepare(`
        SELECT hash, created_at
        FROM __drizzle_migrations
        ORDER BY rowid DESC LIMIT 1
      `).get() as { hash: string; created_at: number }

      if (
        latest.hash !== migrationHash ||
        latest.created_at !== entry.when
      ) {
        throw new Error('AthleteProfile canonical metadata mismatch')
      }

      sqlite.exec('COMMIT')
    } catch (error) {
      if (sqlite.inTransaction) sqlite.exec('ROLLBACK')
      throw error
    }
  } finally {
    // Restoration occurs after COMMIT or ROLLBACK, never inside a transaction.
    if (!sqlite.inTransaction) {
      sqlite.pragma('foreign_keys = ON')
    }

    if (
      sqlite.inTransaction ||
      sqlite.pragma('foreign_keys', { simple: true }) !== 1
    ) {
      throw new Error(
        'AthleteProfile failed to restore safe connection state',
      )
    }
  }
}
