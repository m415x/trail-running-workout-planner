import {
  assertAccreditedAcceptanceDatabasePath,
  saveAcceptanceDatabaseSelection,
  type AcceptanceDatabasePathInput,
} from '@/scripts/acceptance-dev-target'
import { openAcceptanceSqliteReadonly } from '@/scripts/acceptance-dev-readonly'
import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'
import { assertAcceptanceMigrationMetadata } from '@/scripts/acceptance-dev-migration-metadata'
import { assertAcceptanceSqliteIntegrity } from '@/scripts/acceptance-dev-integrity'
import { assertAcceptanceH1Actor } from '@/scripts/acceptance-dev-h1-actor'

export interface AcceptanceSqlitePreflightInput extends AcceptanceDatabasePathInput {
  // Optional runtime-only actor validation for callers that already hold a
  // legitimate session. The CLI must not obtain or invent these fields.
  subject?: string
  teamId?: string
}

/**
 * KAN-885/T2: fail-closed composition of existing read-only SQLite guards.
 *
 * Checks accredited path, HEAD physical schema, canonical applied migrations
 * and SQLite integrity. An existing H1 link can optionally be checked for a
 * caller-supplied authenticated actor, but is not required to start Next. H2
 * authentication and H3/H4A authorization remain inside the real application.
 *
 * No seeding, provisioning, migrations or repairs. Always close the connection.
 */
export function preflightAcceptanceSqlite(input: AcceptanceSqlitePreflightInput): string {
  const canonicalPath = assertAccreditedAcceptanceDatabasePath(input)
  const sqlite = openAcceptanceSqliteReadonly(canonicalPath)

  try {
    assertAcceptancePhysicalSchema(sqlite)
    assertAcceptanceMigrationMetadata({ sqlite, projectRoot: input.projectRoot })
    assertAcceptanceSqliteIntegrity(sqlite)
    // H2/Team are never inferred from a local command or stored config.
    // A caller asking for actor validation must provide both values; the
    // normal launcher path does structural fixture checks only.
    if (input.subject !== undefined || input.teamId !== undefined) {
      assertAcceptanceH1Actor({
        sqlite,
        subject: input.subject ?? '',
        teamId: input.teamId ?? '',
      })
    }
    return canonicalPath
  } finally {
    sqlite.close()
  }
}

export interface AcceptancePreflightAndSaveInput extends AcceptanceSqlitePreflightInput {
  configPath: string
}

/**
 * KAN-885/T3: persist the non-sensitive selection only after EVERY read-only
 * structural preflight guard succeeds. Optional actor validation is performed
 * only when the calling authenticated runtime supplies an existing actor;
 * this helper never authenticates H2 or stores actor identity.
 */
export function preflightAndSaveAcceptanceSelection(
  input: AcceptancePreflightAndSaveInput,
): string {
  const canonicalPath = preflightAcceptanceSqlite(input)
  saveAcceptanceDatabaseSelection({
    databasePath: canonicalPath,
    projectRoot: input.projectRoot,
    configPath: input.configPath,
  })
  return canonicalPath
}
