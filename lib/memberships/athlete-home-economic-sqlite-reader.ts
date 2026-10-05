import {
  createAthleteHomeEconomicAccountAdapter,
} from './athlete-home-economic-account-adapter'
import {
  createAthleteHomeEconomicReader,
} from './athlete-home-economic-reader'

type EconomicPort = ReturnType<
  Parameters<typeof createAthleteHomeEconomicAccountAdapter>[0]['createPort']
>

/**
 * Composes the scoped persistence boundary with the canonical H4/H5 account
 * adapter and the lightweight Home projection. The caller supplies a
 * per-request database-backed port; no history is loaded for presentation.
 */
export function createAthleteHomeEconomicSqliteReader({
  createDatabase,
}: {
  createDatabase: () => EconomicPort
}) {
  const readAccount = createAthleteHomeEconomicAccountAdapter({
    createPort: createDatabase,
  })

  return createAthleteHomeEconomicReader({ readAccount })
}
