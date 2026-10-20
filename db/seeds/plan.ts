import { db } from '@/db/index'
import { assertAccreditedScenarioSeedTarget } from '@/db/seeds/assert-disposable-target'
import { seedTeamAndCoach } from '@/db/seeds/team-and-coach'
import { seedAthletes } from '@/db/seeds/athletes'
import { seedGroups } from '@/db/seeds/groups'
import { seedCohorts } from '@/db/seeds/cohorts'
import { seedPlanningTemplatesAndSessions } from '@/db/seeds/planning-templates-and-sessions'
import { seedPlanStrategies } from '@/db/seeds/plan-strategies'

function shiftISODate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function main(): Promise<void> {
  assertAccreditedScenarioSeedTarget()
  await seedTeamAndCoach(db)
  const groups = await seedGroups(db)
  await seedAthletes(db, [])
  const currentWeekStart = '2026-09-21'
  await seedCohorts(db, groups, currentWeekStart, shiftISODate)
  await seedPlanningTemplatesAndSessions(db, groups, currentWeekStart, shiftISODate, {
    includeLegacySession: false,
  })
  await seedPlanStrategies(db)
  console.log('KAN-836: plan hierarchy initialized without effective sessions')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
