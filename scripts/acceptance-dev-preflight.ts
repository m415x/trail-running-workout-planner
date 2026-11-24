import {
  assertAccreditedAcceptanceDatabasePath,
  type AcceptanceDatabasePathInput,
} from '@/scripts/acceptance-dev-target'
import { openAcceptanceSqliteReadonly } from '@/scripts/acceptance-dev-readonly'
import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'
import { assertAcceptanceMigrationMetadata } from '@/scripts/acceptance-dev-migration-metadata'
import { assertAcceptanceSqliteIntegrity } from '@/scripts/acceptance-dev-integrity'

/**
 * KAN-885/T2: fail-closed composition of existing read-only SQLite guards.
 *
 * Checks accredited path, minimal physical schema, canonical applied migration
 * history from the current checkout, and SQLite integrity. Authentic H2 and
 * full product-schema compatibility remain separate mandatory acceptance gates.
 *
 * No seeding, provisioning, migrations or repairs. Always close the connection.
 */
export function preflightAcceptanceSqlite(input: AcceptanceDatabasePathInput): string {
  const canonicalPath = assertAccreditedAcceptanceDatabasePath(input)
  const sqlite = openAcceptanceSqliteReadonly(canonicalPath)

  try {
    assertAcceptancePhysicalSchema(sqlite)
    assertAcceptanceMigrationMetadata({ sqlite, projectRoot: input.projectRoot })
    assertAcceptanceSqliteIntegrity(sqlite)
    return canonicalPath
  } finally {
    sqlite.close()
  }
}
