import {
  assertAccreditedAcceptanceDatabasePath,
  type AcceptanceDatabasePathInput,
} from '@/scripts/acceptance-dev-target'
import { openAcceptanceSqliteReadonly } from '@/scripts/acceptance-dev-readonly'
import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'
import { assertAcceptanceMigrationMetadata } from '@/scripts/acceptance-dev-migration-metadata'
import { assertAcceptanceSqliteIntegrity } from '@/scripts/acceptance-dev-integrity'
import { assertAcceptanceH1Actor } from '@/scripts/acceptance-dev-h1-actor'

export interface AcceptanceSqlitePreflightInput extends AcceptanceDatabasePathInput {
  // Runtime-only context derived from a legitimate existing session.
  // Never write these values to a local selection/config file.
  subject?: string
  teamId?: string
}

/**
 * KAN-885/T2: fail-closed composition of existing read-only SQLite guards.
 *
 * Checks accredited path, HEAD physical schema, canonical applied migrations,
 * SQLite integrity, and existing H1 subject/Team membership. The H1 check
 * does not authenticate Supabase H2 or authorize an H4A action.
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
    // Mandatory for success: missing actor context is also rejected fail-closed.
    assertAcceptanceH1Actor({
      sqlite,
      subject: input.subject ?? '',
      teamId: input.teamId ?? '',
    })
    return canonicalPath
  } finally {
    sqlite.close()
  }
}
