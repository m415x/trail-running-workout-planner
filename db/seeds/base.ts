import { db } from '@/db/index'
import { assertAccreditedScenarioSeedTarget } from '@/db/seeds/assert-disposable-target'
import { seedAthletes } from '@/db/seeds/athletes'
import { seedTeamAndCoach } from '@/db/seeds/team-and-coach'

async function main(): Promise<void> {
  assertAccreditedScenarioSeedTarget()
  await seedTeamAndCoach(db)
  await seedAthletes(db, [])
  console.log('KAN-835: Team and ungrouped athletes initialized')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
