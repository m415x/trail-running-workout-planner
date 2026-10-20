import { assertAccreditedScenarioSeedTarget } from '@/db/seeds/assert-disposable-target'

/**
 * KAN-837/S5 compatibility boundary.
 * The historical seed remains the source of truth for effective sessions,
 * prescriptions and H4B IDs until extraction is proven equivalent.
 */
async function main(): Promise<void> {
  assertAccreditedScenarioSeedTarget()
  await import('@/db/seed')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
