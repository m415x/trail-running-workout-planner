import {
  assertAccreditedAcceptanceDatabasePath,
  type AcceptanceDatabasePathInput,
} from '@/scripts/acceptance-dev-target'
import { openAcceptanceSqliteReadonly } from '@/scripts/acceptance-dev-readonly'
import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'
import { assertAcceptanceSqliteIntegrity } from '@/scripts/acceptance-dev-integrity'

/**
 * KAN-885/T2 RED-8: fail-closed composition of the existing read-only guards.
 *
 * This preflight only confirms path accreditation, the minimal physical schema,
 * and SQLite integrity. Migration journal/hash compatibility and authentic H2
 * identity remain separate mandatory checks before launching Next.js.
 *
 * No seeding, provisioning, migrations or repairs. Always close the connection.
 */
export function preflightAcceptanceSqlite(input: AcceptanceDatabasePathInput): string {
  const canonicalPath = assertAccreditedAcceptanceDatabasePath(input)
  const sqlite = openAcceptanceSqliteReadonly(canonicalPath)

  try {
    assertAcceptancePhysicalSchema(sqlite)
    assertAcceptanceSqliteIntegrity(sqlite)
    return canonicalPath
  } finally {
    sqlite.close()
  }
}
