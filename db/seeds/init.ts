import { db } from '@/db/index'
import { assertAccreditedScenarioSeedTarget } from '@/db/seeds/assert-disposable-target'
import { seedTeamAndCoach } from '@/db/seeds/team-and-coach'

async function main(): Promise<void> {
  assertAccreditedScenarioSeedTarget()
  await seedTeamAndCoach(db)
  console.log('KAN-835: structural Team initialized')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
