import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as coreSchema from '@/db/schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import * as competitionEntrySchema from '@/db/competition-entry-schema'
import * as readinessSchema from '@/db/readiness-schema'
import * as raceCatalogSchema from '@/db/race-catalog-schema'
import * as raceRegistrationSchema from '@/db/race-registration-schema'
import { seedFeature, seedFull } from '@/db/seeds'


export type SqliteVerificationScenario =
  | 'empty'
  | 'full-seed'
  | 'base-seed'
  | 'partial-seed'
  | 'upgrade'
  | 'preservation'
  | 'drift'
  | 'rerun'
  | 'partial-metadata-head'

export const sqliteVerificationScenarios: SqliteVerificationScenario[] = [
  'empty',
  'full-seed',
  'base-seed',
  'partial-seed',
  'upgrade',
  'preservation',
  'drift',
  'rerun',
  'partial-metadata-head',
]

export interface ScenarioWorkspace {
  root: string
  sqlitePath: string
}

export function createScenarioWorkspace(name: SqliteVerificationScenario): ScenarioWorkspace {
  const root = mkdtempSync(join(tmpdir(), `trail-running-sqlite-${name}-`))
  return { root, sqlitePath: join(root, 'sqlite.db') }
}

export function removeScenarioWorkspace(workspace: ScenarioWorkspace): void {
  rmSync(workspace.root, { recursive: true, force: true })
}

export function runScenarioCommand(
  cwd: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): void {
  const projectTsconfig = resolve('tsconfig.json')
  const result = spawnSync(command, args, {
    cwd,
    env: { ...env, TSX_TSCONFIG_PATH: projectTsconfig, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: join(cwd, 'sqlite.db') },
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      [`SQLite scenario command failed: ${command} ${args.join(' ')}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

export function runEmptyBootstrapScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('empty')
  try {
    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    // Run from the isolated workspace so the canonical upgrade targets its
    // sqlite.db rather than the developer database. No seed composition runs.
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    assertScenarioDatabaseExists(workspace)
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export async function runFullSeedScenario(projectRoot = process.cwd()): Promise<void> {
  const workspace = createScenarioWorkspace('full-seed')
  try {
    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    assertScenarioDatabaseExists(workspace)

    const sqlite = new Database(workspace.sqlitePath)
    try {
      const scenarioDb = drizzle(sqlite, {
        schema: {
          ...coreSchema,
          ...loadStrategySchema,
          ...intensityStrategySchema,
          ...sessionGenerationPreferencesSchema,
          ...competitionEntrySchema,
          ...readinessSchema,
          ...raceCatalogSchema,
          ...raceRegistrationSchema,
        },
      })

      const currentWeekStart = '2026-09-21'
      const shiftISODate = (value: string, days: number): string => {
        const date = new Date(`${value}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + days)
        return date.toISOString().slice(0, 10)
      }

      await seedFull(scenarioDb, { currentWeekStart, shiftISODate })
    } finally {
      sqlite.close()
    }

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export function runBaseSeedScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('base-seed')
  try {
    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const seedScript = resolve(projectRoot, 'db/seed.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, seedScript])

    // Verify the H4B shared fixture on a freshly migrated temporary SQLite,
    // then rerun the real base seed to assert idempotence of the same records.
    const assertSharedFixture = () => {
      const check = new Database(workspace.sqlitePath, { readonly: true, fileMustExist: true })
      try {
        const rows = check.prepare(`
          SELECT s.id AS session_id, s.team_id, s.generation_ownership,
                 p.id AS prescription_id, p.group_id, p.microcycle_id,
                 g.team_id AS group_team_id, gp.group_id AS plan_group_id
          FROM sessions s
          JOIN group_session_prescriptions p ON p.session_id = s.id
          JOIN athlete_groups g ON g.id = p.group_id
          JOIN microcycles mi ON mi.id = p.microcycle_id
          JOIN mesocycles me ON me.id = mi.mesocycle_id
          JOIN macrocycles ma ON ma.id = me.macrocycle_id
          JOIN group_training_plans gp ON gp.id = ma.group_training_plan_id
          WHERE s.id = 'accept_h4b_shared_session'
            AND s.is_deleted = 0 AND p.is_deleted = 0
          ORDER BY p.id
        `).all() as Array<{
          session_id: string; team_id: string; generation_ownership: string
          prescription_id: string; group_id: string; microcycle_id: string
          group_team_id: string; plan_group_id: string
        }>
        const expectedGroups = ['team_1_M1', 'team_1_S2']
        const actualGroups = rows.map(row => row.group_id).sort()
        if (JSON.stringify(actualGroups) !== JSON.stringify(expectedGroups)
          || rows.some(row => row.team_id !== 'team_1'
            || row.group_team_id !== 'team_1'
            || row.plan_group_id !== row.group_id
            || row.generation_ownership !== 'manual')
          || new Set(rows.map(row => row.microcycle_id)).size !== 2
        ) {
          throw new Error(`H4B shared fixture invalid: ${JSON.stringify(rows)}`)
        }
        if ((check.pragma('foreign_key_check') as unknown[]).length > 0) {
          throw new Error('H4B shared fixture violates foreign keys')
        }
        return JSON.stringify(rows)
      } finally {
        check.close()
      }
    }

    // Provision acceptance actors only inside the isolated temporary workspace.
    // The CLI safety guard refuses scenario mode, so this dedicated test
    // deliberately runs with a disposable cwd and without that mode variable.
    const actorScript = resolve(projectRoot, 'scripts/provision-h4b-acceptance-actors.ts')
    const runActorFixture = (apply: boolean) => {
      const execution = spawnSync(process.execPath, [
        tsxCli, actorScript, ...(apply ? ['--apply'] : []),
      ], {
        cwd: workspace.root,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: 'false',
          SQLITE_SCENARIO_MODE: '',
          TSX_TSCONFIG_PATH: resolve(projectRoot, 'tsconfig.json'),
        },
        encoding: 'utf8',
        timeout: 120000,
      })
      if (execution.error || execution.status !== 0) {
        throw new Error(`Acceptance actor fixture failed: ${String(execution.error ?? '')} ${execution.stdout} ${execution.stderr}`)
      }
      return execution.stdout
    }
    if (!runActorFixture(false).includes('"status": "absent"')) {
      throw new Error('Acceptance actors were not absent on fresh SQLite')
    }
    if (!runActorFixture(true).includes('four independent local EPT identities provisioned atomically')) {
      throw new Error('Acceptance actors did not initialize on fresh SQLite')
    }
    if (!runActorFixture(true).includes('already provisioned; no mutation')) {
      throw new Error('Acceptance actors rerun was not idempotent')
    }

    const verifyActors = new Database(workspace.sqlitePath, { readonly: true, fileMustExist: true })
    try {
      const expected = [
        ['athlete', '1579feb3-60b3-45eb-83f6-c8eb312cd4c8'],
        ['assistant', 'd2764887-4301-4b15-982a-71ef47274e90'],
        ['coach', '65375bd2-4a7a-4a00-bf41-d289ec1d54f5'],
        ['admin', '6b6c6713-a0da-4854-8eba-46dcba22e8ac'],
      ] as const
      for (const [preset, subject] of expected) {
        const userId = `accept_h4b_${preset}`
        const links = verifyActors.prepare(
          "SELECT user_id FROM external_identity_links WHERE provider='supabase' AND subject=? AND is_deleted=0",
        ).all(subject) as Array<{ user_id: string }>
        const memberships = verifyActors.prepare(
          'SELECT preset FROM team_memberships WHERE user_id=? AND team_id=? AND is_active=1 AND is_deleted=0 AND effective_until IS NULL',
        ).all(userId, 'team_1') as Array<{ preset: string }>
        const profiles = verifyActors.prepare(
          'SELECT id,group_id FROM athlete_profiles WHERE user_id=? AND team_id=? AND is_deleted=0',
        ).all(userId, 'team_1') as Array<{id:string;group_id:string|null}>
        if (links.length !== 1 || links[0]?.user_id !== userId
          || memberships.length !== 1 || memberships[0]?.preset !== preset
          || (preset === 'athlete'
            ? profiles.length !== 1 || profiles[0]?.id !== 'accept_h4b_profile_athlete'
              || profiles[0]?.group_id !== 'team_1_S2'
            : profiles.length !== 0)) {
          throw new Error(`Invalid acceptance actor on fresh SQLite: ${preset}`)
        }
      }
      if ((verifyActors.pragma('foreign_key_check') as unknown[]).length > 0) {
        throw new Error('Acceptance actor fixture violates foreign keys')
      }
    } finally {
      verifyActors.close()
    }

    const firstSharedFixture = assertSharedFixture()
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, seedScript])
    if (assertSharedFixture() !== firstSharedFixture) {
      throw new Error('H4B shared fixture was modified by repeat base seed')
    }

    const sqlite = new Database(workspace.sqlitePath, { fileMustExist: true })
    try {
      const overlappingPlanning = sqlite.prepare(`
        SELECT g.category_code || g.level_code AS group_code, COUNT(*) AS count
        FROM microcycles mi
        INNER JOIN mesocycles me ON me.id = mi.mesocycle_id
        INNER JOIN macrocycles ma ON ma.id = me.macrocycle_id
        INNER JOIN group_training_plans gp ON gp.id = ma.group_training_plan_id
        INNER JOIN athlete_groups g ON g.id = gp.group_id
        WHERE mi.is_deleted = 0
          AND me.is_deleted = 0
          AND ma.is_deleted = 0
          AND gp.is_deleted = 0
          AND mi.start_date <= '2026-09-21'
          AND mi.end_date >= '2026-09-21'
        GROUP BY gp.group_id
        HAVING COUNT(*) > 1
      `).all() as Array<{ group_code: string; count: number }>

      if (overlappingPlanning.length > 0) {
        throw new Error(`Base seed contains ambiguous active microcycles: ${overlappingPlanning.map(row => `${row.group_code}=${row.count}`).join(', ')}`)
      }
    } finally {
      sqlite.close()
    }
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export async function runPartialSeedScenario(projectRoot = process.cwd()): Promise<void> {
  const features = ['groups', 'competitions'] as const

  for (const feature of features) {
    const workspace = createScenarioWorkspace('partial-seed')
    try {
      const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
      const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
      const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

      runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
      assertScenarioDatabaseExists(workspace)

      const sqlite = new Database(workspace.sqlitePath)
      try {
        const scenarioDb = drizzle(sqlite, {
          schema: {
            ...coreSchema,
            ...loadStrategySchema,
            ...intensityStrategySchema,
            ...sessionGenerationPreferencesSchema,
            ...competitionEntrySchema,
            ...readinessSchema,
            ...raceCatalogSchema,
            ...raceRegistrationSchema,
          },
        })
        const currentWeekStart = '2026-09-21'
        const shiftISODate = (value: string, days: number): string => {
          const date = new Date(`${value}T00:00:00Z`)
          date.setUTCDate(date.getUTCDate() + days)
          return date.toISOString().slice(0, 10)
        }

        await seedFeature(scenarioDb, feature, { currentWeekStart, shiftISODate })
      } finally {
        sqlite.close()
      }

      runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
    } finally {
      removeScenarioWorkspace(workspace)
    }
  }
}

export function createRepresentativeLegacyDatabase(workspace: ScenarioWorkspace, projectRoot = process.cwd()): void {
  const sqlite = new Database(workspace.sqlitePath)
  try {
    // 0000 represents the reviewed pre-versioned physical shape: application
    // tables exist, workout_logs still has INTEGER duration and no
    // performed_at, and no __drizzle_migrations metadata has been established.
    sqlite.exec(readFileSync(resolve(projectRoot, 'drizzle/sqlite/0000_baseline.sql'), 'utf8'))
  } finally {
    sqlite.close()
  }
}

export function runUpgradeScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('upgrade')
  try {
    createRepresentativeLegacyDatabase(workspace, projectRoot)

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export function runPreservationScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('preservation')
  try {
    createRepresentativeLegacyDatabase(workspace, projectRoot)

    const sqlite = new Database(workspace.sqlitePath)
    try {
      const now = '2026-09-22T00:00:00.000Z'
      sqlite.exec(`
        INSERT INTO teams (id, created_at, updated_at, name)
        VALUES ('preservation-team', '${now}', '${now}', 'Preservation Team');

        INSERT INTO users (id, created_at, updated_at, role, user_name, email, first_name, last_name)
        VALUES ('preservation-user', '${now}', '${now}', 'athlete', 'preservation-user',
                'preservation@example.test', 'Preservation', 'Athlete');

        INSERT INTO athlete_profiles
          (id, created_at, updated_at, user_id, team_id, dni)
        VALUES
          ('preservation-athlete', '${now}', '${now}', 'preservation-user',
           'preservation-team', 'KAN427');

        INSERT INTO workout_logs
          (id, created_at, updated_at, athlete_id, date, status, distance_km,
           duration_min, elevation_gain, rpe, logged_at)
        VALUES
          ('preservation-log', '${now}', '${now}', 'preservation-athlete',
           '2026-09-22', 'completed', 10.5, 64, 420, 6, '${now}');

        INSERT INTO memberships
          (id, created_at, updated_at, athlete_id, start_date, end_date, amount,
           status, payment_method, notes)
        VALUES
          ('preservation-membership', '${now}', '${now}', 'preservation-athlete',
           '2026-09-01', '2026-09-30', 25000, 'active', 'transfer',
           'legacy membership preservation fixture');

        INSERT INTO athlete_groups
          (id, created_at, updated_at, category_code, level_code, team_id, description)
        VALUES
          ('preservation-group', '${now}', '${now}', 'S', '2', 'preservation-team',
           'KAN-522 prescription preservation group');

        INSERT INTO group_training_plans
          (id, created_at, updated_at, group_id, title, status)
        VALUES
          ('preservation-plan', '${now}', '${now}', 'preservation-group',
           'KAN-522 preservation plan', 'active');

        INSERT INTO macrocycles
          (id, created_at, updated_at, title, group_training_plan_id, start_date, end_date)
        VALUES
          ('preservation-macrocycle', '${now}', '${now}', 'Preservation macrocycle',
           'preservation-plan', '2026-09-01', '2026-12-31');

        INSERT INTO mesocycles
          (id, created_at, updated_at, macrocycle_id, title, number, period, objective)
        VALUES
          ('preservation-mesocycle', '${now}', '${now}', 'preservation-macrocycle',
           'Preservation mesocycle', 1, 'base', 'Preserve prescription lineage');

        INSERT INTO microcycles
          (id, created_at, updated_at, mesocycle_id, week_number, type, start_date, end_date)
        VALUES
          ('preservation-microcycle', '${now}', '${now}', 'preservation-mesocycle',
           1, 'load', '2026-09-21', '2026-09-27');

        INSERT INTO sessions
          (id, created_at, updated_at, team_id, date, title, type, generation_ownership, shared_event_key)
        VALUES
          ('preservation-session', '${now}', '${now}', 'preservation-team',
           '2026-09-22', 'Preservation session', 'Trail', 'generated',
           'preservation-team::2026-09-22::mountain::template-preservation');

        INSERT INTO group_session_prescriptions
          (id, created_at, updated_at, session_id, group_id, microcycle_id,
           distance_km, duration_min, elevation_gain, intensity_method, zone,
           notes, generation_ownership, generation_key)
        VALUES
          ('preservation-prescription', '${now}', '${now}', 'preservation-session',
           'preservation-group', 'preservation-microcycle', 12.5, 95, 650,
           'hr_zone', 'Z2', 'preserve planning scope', 'generated',
           'preservation-plan::preservation-microcycle::preservation-group::mountain');

        INSERT INTO session_generation_modification_records
          (id, created_at, updated_at, group_training_plan_id, session_id, prescription_id,
           action, ownership, generation_key, previous_value, new_value, changed_by_user_id)
        VALUES
          ('preservation-generation-audit', '${now}', '${now}', 'preservation-plan',
           'preservation-session', 'preservation-prescription', 'generated_created',
           'generated',
           'preservation-plan::preservation-microcycle::preservation-group::mountain',
           NULL, '{"distanceKm":12.5,"elevationGain":650}', NULL);
      `)
    } finally {
      sqlite.close()
    }

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])

    const upgraded = new Database(workspace.sqlitePath, { fileMustExist: true })
    try {
      const row = upgraded.prepare(`
        SELECT id, athlete_id, distance_km, duration_min, elevation_gain, rpe, performed_at
        FROM workout_logs
        WHERE id = ?
      `).get('preservation-log') as {
        id: string
        athlete_id: string
        distance_km: number
        duration_min: number
        elevation_gain: number
        rpe: number
        performed_at: string | null
      } | undefined

      if (
        !row ||
        row.athlete_id !== 'preservation-athlete' ||
        row.distance_km !== 10.5 ||
        row.duration_min !== 64 ||
        row.elevation_gain !== 420 ||
        row.rpe !== 6 ||
        row.performed_at !== null
      ) {
        throw new Error('Supported SQLite upgrade did not preserve the representative workout log')
      }

      const legacyMembership = upgraded.prepare(`
        SELECT id, athlete_id, start_date, end_date, amount, status, payment_method, notes
        FROM memberships
        WHERE id = ?
      `).get('preservation-membership') as {
        id: string
        athlete_id: string
        start_date: string
        end_date: string
        amount: number
        status: string
        payment_method: string | null
        notes: string | null
      } | undefined

      if (
        !legacyMembership ||
        legacyMembership.athlete_id !== 'preservation-athlete' ||
        legacyMembership.start_date !== '2026-09-01' ||
        legacyMembership.end_date !== '2026-09-30' ||
        legacyMembership.amount !== 25000 ||
        legacyMembership.status !== 'active' ||
        legacyMembership.payment_method !== 'transfer' ||
        legacyMembership.notes !== 'legacy membership preservation fixture'
      ) {
        throw new Error('Supported SQLite upgrade did not preserve the representative legacy membership')
      }

      const preservedPrescription = upgraded.prepare(`
        SELECT id, session_id, group_id, microcycle_id, distance_km, duration_min,
               elevation_gain, intensity_method, zone, notes,
               generation_ownership, generation_key
        FROM group_session_prescriptions
        WHERE id = ?
      `).get('preservation-prescription') as {
        id: string
        session_id: string
        group_id: string
        microcycle_id: string
        distance_km: number | null
        duration_min: number | null
        elevation_gain: number | null
        intensity_method: string | null
        zone: string | null
        notes: string | null
        generation_ownership: string
        generation_key: string | null
      } | undefined

      if (
        !preservedPrescription ||
        preservedPrescription.session_id !== 'preservation-session' ||
        preservedPrescription.group_id !== 'preservation-group' ||
        preservedPrescription.microcycle_id !== 'preservation-microcycle' ||
        preservedPrescription.distance_km !== 12.5 ||
        preservedPrescription.duration_min !== 95 ||
        preservedPrescription.elevation_gain !== 650 ||
        preservedPrescription.intensity_method !== 'hr_zone' ||
        preservedPrescription.zone !== 'Z2' ||
        preservedPrescription.notes !== 'preserve planning scope' ||
        preservedPrescription.generation_ownership !== 'generated' ||
        preservedPrescription.generation_key !==
          'preservation-plan::preservation-microcycle::preservation-group::mountain'
      ) {
        throw new Error('Supported SQLite upgrade did not preserve the representative group session prescription')
      }

      const preservedGenerationAudit = upgraded.prepare(`
        SELECT id, group_training_plan_id, session_id, prescription_id, action, ownership,
               generation_key, previous_value, new_value, changed_by_user_id,
               generation_explanation
        FROM session_generation_modification_records
        WHERE id = ?
      `).get('preservation-generation-audit') as {
        id: string
        group_training_plan_id: string
        session_id: string | null
        prescription_id: string | null
        action: string
        ownership: string
        generation_key: string | null
        previous_value: string | null
        new_value: string | null
        changed_by_user_id: string | null
        generation_explanation: string | null
      } | undefined

      if (
        !preservedGenerationAudit ||
        preservedGenerationAudit.group_training_plan_id !== 'preservation-plan' ||
        preservedGenerationAudit.session_id !== 'preservation-session' ||
        preservedGenerationAudit.prescription_id !== 'preservation-prescription' ||
        preservedGenerationAudit.action !== 'generated_created' ||
        preservedGenerationAudit.ownership !== 'generated' ||
        preservedGenerationAudit.generation_key !==
          'preservation-plan::preservation-microcycle::preservation-group::mountain' ||
        preservedGenerationAudit.previous_value !== null ||
        preservedGenerationAudit.new_value !== '{"distanceKm":12.5,"elevationGain":650}' ||
        preservedGenerationAudit.changed_by_user_id !== null ||
        preservedGenerationAudit.generation_explanation !== null
      ) {
        throw new Error(
          'Supported SQLite upgrade did not preserve the representative generation audit',
        )
      }

      const planningScopeIndex = upgraded.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'index'
          AND name = 'group_session_prescriptions_session_microcycle_unique'
      `).get() as { name: string } | undefined
      if (!planningScopeIndex) {
        throw new Error('Supported SQLite upgrade did not install group_session_prescriptions_session_microcycle_unique')
      }

      for (const table of ['team_economic_policies', 'athlete_billing_terms', 'monthly_charges']) {
        const inferred = upgraded.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
        if (inferred.count !== 0) {
          throw new Error(`Supported SQLite upgrade inferred H1 billing facts from a legacy membership: ${table}`)
        }
      }
    } finally {
      upgraded.close()
    }

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

/**
 * Compare SQLite DDL by tokens rather than sqlite_master formatting.
 * Quoted identifiers and string literals remain intact, including whitespace
 * inside string defaults; column definitions and constraints are not discarded.
 */
export function normalizeSqliteSchemaSql(sql: string | null): string | null {
  if (sql === null) return null
  const tokens = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]+\]|[(),]|[^\s(),]+/g) ?? []
  const quoteIdentifier = (value: string) => '`' + value.replaceAll('`', '``') + '`'
  const canonical = tokens.map(token => {
    if (token.startsWith('"') && token.endsWith('"')) {
      return quoteIdentifier(token.slice(1, -1).replaceAll('""', '"'))
    }
    if (token.startsWith('[') && token.endsWith(']')) {
      return quoteIdentifier(token.slice(1, -1))
    }
    return token
  })

  // ALTER TABLE ADD COLUMN appends columns physically. Compare complete column
  // and table-constraint declarations, but not their positional order.
  if (canonical[0]?.toUpperCase() === 'CREATE' && canonical[1]?.toUpperCase() === 'TABLE') {
    const opening = canonical.indexOf('(')
    if (opening !== -1) {
      const declarations: string[][] = []
      let current: string[] = []
      let depth = 0
      let closing = -1
      for (let i = opening + 1; i < canonical.length; i++) {
        const token = canonical[i]
        if (token === ')' && depth === 0) {
          if (current.length > 0) declarations.push(current)
          closing = i
          break
        }
        if (token === ',' && depth === 0) {
          declarations.push(current)
          current = []
          continue
        }
        if (token === '(') depth++
        if (token === ')') depth--
        current.push(token)
      }
      if (closing !== -1) {
        return [
          ...canonical.slice(0, opening + 1),
          ...declarations.map(declaration => declaration.join(' ')).sort(),
          ...canonical.slice(closing),
        ].join(' ')
      }
    }
  }

  return canonical.join(' ')
}

function readNormalizedSchema(sqlitePath: string): string[] {
  const sqlite = new Database(sqlitePath, { fileMustExist: true })
  try {
    return (sqlite.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND name <> '__drizzle_migrations'
        AND tbl_name <> '__drizzle_migrations'
      ORDER BY type, name
    `).all() as Array<{ type: string; name: string; tbl_name: string; sql: string | null }>)
      .map(row => {
        // SQLite appends columns and can rewrite inline foreign keys on ALTER.
        // Compare the affected table by its actual columns and foreign keys.
        if (row.type === 'table' && row.name === 'field_performance_tests') {
          const columns = (sqlite.pragma('table_xinfo(field_performance_tests)') as Array<{
            name: string; type: string; notnull: number; dflt_value: string | null; pk: number; hidden: number
          }>).map(({ name, type, notnull, dflt_value, pk, hidden }) =>
            ({ name, type: type.toUpperCase(), notnull, dflt_value, pk, hidden }),
          ).sort((a, b) => a.name.localeCompare(b.name))
          const foreignKeys = (sqlite.pragma('foreign_key_list(field_performance_tests)') as Array<{
            table: string; from: string; to: string; on_update: string; on_delete: string; match: string; seq: number
          }>).map(({ table, from, to, on_update, on_delete, match, seq }) =>
            ({ table, from, to, on_update, on_delete, match, seq }),
          ).sort((a, b) => a.from.localeCompare(b.from) || a.seq - b.seq)
          return JSON.stringify({ type: row.type, name: row.name, tbl_name: row.tbl_name, columns, foreignKeys })
        }
        const sql = row.type === 'trigger'
          ? row.sql?.replace(/^CREATE\\s+TRIGGER\\s+IF\\s+NOT\\s+EXISTS\\s+/i, 'CREATE TRIGGER ')
          : row.sql
        return JSON.stringify({ ...row, sql: normalizeSqliteSchemaSql(sql ?? null) })
      })
  } finally {
    sqlite.close()
  }
}

export function runDriftScenario(projectRoot = process.cwd()): void {
  const fresh = createScenarioWorkspace('drift')
  const upgraded = createScenarioWorkspace('drift')
  try {
    createRepresentativeLegacyDatabase(upgraded, projectRoot)

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(fresh.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(upgraded.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(fresh.root, process.execPath, [tsxCli, verifyScript])
    runScenarioCommand(upgraded.root, process.execPath, [tsxCli, verifyScript])

    const freshSchema = readNormalizedSchema(fresh.sqlitePath)
    const upgradedSchema = readNormalizedSchema(upgraded.sqlitePath)
    // Compare keyed, fully normalized schema entries. SQLite can list objects
    // in a different order even when their structure is identical.
    const schemaByObject = (entries: string[]) => new Map(entries.map(entry => {
      const parsed = JSON.parse(entry) as { type: string; name: string }
      return [`${parsed.type}:${parsed.name}`, entry] as const
    }))
    const freshEntries = schemaByObject(freshSchema)
    const upgradedEntries = schemaByObject(upgradedSchema)
    const differences = [...new Set([...freshEntries.keys(), ...upgradedEntries.keys()])]
      .filter(key => freshEntries.get(key) !== upgradedEntries.get(key))
    if (differences.length > 0) {
      const first = differences[0]
      const freshEntry = freshEntries.get(first)
      const upgradedEntry = upgradedEntries.get(first)
      const firstSql = (entry: string | undefined) => entry
        ? (JSON.parse(entry) as { sql?: string | null }).sql ?? entry
        : '<missing>'
      const freshSql = firstSql(freshEntry)
      const upgradedSql = firstSql(upgradedEntry)
      const mismatchAt = [...freshSql].findIndex((character, index) => character !== upgradedSql[index])
      const offset = mismatchAt >= 0 ? mismatchAt : Math.min(freshSql.length, upgradedSql.length)
      const excerpt = (sql: string) => sql.slice(Math.max(0, offset - 70), offset + 120)
      throw new Error([
        `Schema drift detected: ${differences.length} differing objects`,
        `Objects: ${differences.slice(0, 12).join(', ')}${differences.length > 12 ? ', …' : ''}`,
        `First mismatch: ${first} at character ${offset}`,
        `fresh: ${excerpt(freshSql)}`,
        `upgraded: ${excerpt(upgradedSql)}`,
      ].join('\\n'))
    }
  } finally {
    removeScenarioWorkspace(fresh)
    removeScenarioWorkspace(upgraded)
  }
}

export function runRerunScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('rerun')
  try {
    createRepresentativeLegacyDatabase(workspace, projectRoot)

    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const verifyScript = resolve(projectRoot, 'scripts/verify-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
    const schemaAfterFirstUpgrade = readNormalizedSchema(workspace.sqlitePath)

    // A database already at canonical HEAD must remain a safe no-op target.
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])
    runScenarioCommand(workspace.root, process.execPath, [tsxCli, verifyScript])
    const schemaAfterSecondUpgrade = readNormalizedSchema(workspace.sqlitePath)

    if (
      schemaAfterFirstUpgrade.length !== schemaAfterSecondUpgrade.length ||
      schemaAfterFirstUpgrade.some((entry, index) => entry !== schemaAfterSecondUpgrade[index])
    ) {
      throw new Error('SQLite schema changed after rerunning the supported upgrade at HEAD')
    }
  } finally {
    removeScenarioWorkspace(workspace)
  }
}


export function runPartialMetadataHeadScenario(projectRoot = process.cwd()): void {
  const workspace = createScenarioWorkspace('partial-metadata-head')
  try {
    const upgradeScript = resolve(projectRoot, 'scripts/upgrade-sqlite.ts')
    const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')

    runScenarioCommand(workspace.root, process.execPath, [tsxCli, upgradeScript])

    const sqlite = new Database(workspace.sqlitePath, { fileMustExist: true })
    let beforeSchema: unknown[]
    let beforeMetadata: unknown[]

    try {
      const journal = JSON.parse(readMigrationJournal()) as {
        entries: Array<{ when: number }>
      }
      const keepThrough = journal.entries[1]?.when
      if (keepThrough === undefined) {
        throw new Error('SQLite journal must contain 0001')
      }

      sqlite.prepare(
        'DELETE FROM __drizzle_migrations WHERE created_at > ?',
      ).run(keepThrough)

      beforeSchema = sqlite.prepare(`
        SELECT type, name, tbl_name, sql
        FROM sqlite_master
        ORDER BY type, name
      `).all()

      beforeMetadata = sqlite.prepare(`
        SELECT rowid, id, hash, created_at
        FROM __drizzle_migrations
        ORDER BY rowid
      `).all()
    } finally {
      sqlite.close()
    }

    const execution = spawnSync(
      process.execPath,
      [tsxCli, upgradeScript],
      {
        cwd: workspace.root,
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: resolve(projectRoot, 'tsconfig.json'),
          SQLITE_SCENARIO_MODE: '1',
          SQLITE_DATABASE_PATH: workspace.sqlitePath,
        },
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
      },
    )

    if (execution.error) throw execution.error
    if (execution.status === 0) {
      throw new Error(
        'Partial migration metadata on physical HEAD was repaired silently',
      )
    }

    const output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`
    if (!/AthleteProfile incompatible applied 0016/i.test(output)) {
      throw new Error(
        'Partial migration metadata was not rejected by the KAN-615 applied-0016 integrity guard',
      )
    }

    const rejected = new Database(workspace.sqlitePath, {
      readonly: true,
      fileMustExist: true,
    })

    try {
      const afterSchema = rejected.prepare(`
        SELECT type, name, tbl_name, sql
        FROM sqlite_master
        ORDER BY type, name
      `).all()

      const afterMetadata = rejected.prepare(`
        SELECT rowid, id, hash, created_at
        FROM __drizzle_migrations
        ORDER BY rowid
      `).all()

      if (
        JSON.stringify(afterSchema) !== JSON.stringify(beforeSchema) ||
        JSON.stringify(afterMetadata) !== JSON.stringify(beforeMetadata)
      ) {
        throw new Error(
          'Rejected partial migration metadata state was mutated',
        )
      }

      if ((rejected.pragma('foreign_key_check') as unknown[]).length > 0) {
        throw new Error(
          'Rejected partial migration metadata state has foreign-key violations',
        )
      }
    } finally {
      rejected.close()
    }
  } finally {
    removeScenarioWorkspace(workspace)
  }
}

export function assertScenarioDatabaseExists(workspace: ScenarioWorkspace): void {
  if (!existsSync(workspace.sqlitePath)) {
    throw new Error(`SQLite scenario did not create ${workspace.sqlitePath}`)
  }
}

export function readMigrationJournal(): string {
  return readFileSync(resolve('drizzle/sqlite/meta/_journal.json'), 'utf8')
}

/**
 * KAN-427 scenario harness.
 *
 * The individual scenario executors are intentionally added incrementally:
 * empty bootstrap first, then seedFull/seedFeature, representative upgrade,
 * preservation, fresh-vs-upgraded drift and safe rerun/idempotence.
 */
export function describeSqliteVerificationCoverage(): string {
  return [
    'empty bootstrap without seed',
    'seedFull full-seed',
    'seedFeature partial-seed',
    'representative upgrade to HEAD',
    'existing-data preservation',
    'fresh-vs-upgraded drift comparison',
    'safe rerun idempotence',
    'partial HEAD metadata rejection without mutation',
  ].join('; ')
}


async function main(): Promise<void> {
  const scenario = process.argv[2] as SqliteVerificationScenario | undefined

  if (!scenario) {
    throw new Error(
      `SQLite verification scenario is required: ${sqliteVerificationScenarios.join(', ')}`,
    )
  }

  if (!sqliteVerificationScenarios.includes(scenario)) {
    throw new Error(`Unknown SQLite verification scenario: ${scenario}`)
  }

  if (scenario === 'empty') {
    runEmptyBootstrapScenario()
    return
  }

  if (scenario === 'full-seed') {
    await runFullSeedScenario()
    return
  }

  if (scenario === 'base-seed') {
    runBaseSeedScenario()
    return
  }

  if (scenario === 'partial-seed') {
    await runPartialSeedScenario()
    return
  }

  if (scenario === 'upgrade') {
    runUpgradeScenario()
    return
  }

  if (scenario === 'preservation') {
    runPreservationScenario()
    return
  }

  if (scenario === 'drift') {
    runDriftScenario()
    return
  }

  if (scenario === 'rerun') {
    runRerunScenario()
    return
  }

  if (scenario === 'partial-metadata-head') {
    runPartialMetadataHeadScenario()
    return
  }

  throw new Error(`SQLite verification scenario is not implemented yet: ${scenario}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
