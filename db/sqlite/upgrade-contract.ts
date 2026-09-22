/**
 * KAN-407 SQLite upgrade-state contract.
 *
 * This module classifies the database states that the canonical upgrade runner
 * must handle. It deliberately contains no migration execution: KAN-425 owns
 * that implementation.
 */
export const sqliteUpgradeStateContract = {
  fresh: {
    description: 'No application schema exists yet.',
    action: 'bootstrap through the canonical versioned migration chain',
    preserveExistingData: true,
  },
  versioned: {
    description: 'The database has trustworthy versioned migration metadata.',
    action: 'apply pending canonical migrations and verify the resulting schema',
    preserveExistingData: true,
  },
  legacyPushManaged: {
    description:
      'The database predates the canonical chain or was evolved through db:push or historical one-off migrators.',
    action:
      'reconcile only a recognized legacy shape, preserve existing data, then establish canonical versioned state',
    preserveExistingData: true,
  },
  unrecognized: {
    description:
      'The observed schema cannot be mapped safely to a supported fresh, versioned, or recognized legacy state.',
    action: 'reject the upgrade without destructive recovery or silent data loss',
    preserveExistingData: true,
  },
} as const

export type SqliteUpgradeState = keyof typeof sqliteUpgradeStateContract
