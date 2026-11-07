import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync('app/[locale]/dashboard/layout.tsx', 'utf8')
const home = readFileSync('app/[locale]/dashboard/page.tsx', 'utf8')

test('KAN-869/T6 server H3 Team must key Coach Home lifecycle across a Team switch', () => {
  assert.match(layout, /createActiveTeamNextServerContext|resolve.*ActiveTeam/,
    'Dashboard layout must use the server-owned H3 active Team, not a client-controlled key')
  assert.match(layout, /<DashboardShell\s+key=\{[^}]*team/i,
    'Switching active Team must remount Coach Home and its async state')
})

test('KAN-869/T6 a remount fetches all 3 authorized data domains from loading states', () => {
  assert.match(home, /useState<CoachHomeAthleteCountResult[^\n]*status: 'loading'/)
  assert.match(home, /useState<CoachHomePlanningResult[^\n]*status: 'loading'/)
  assert.match(home, /useState<CoachHomeNextCompetitionResult[^\n]*status: 'loading'/)
  assert.match(home, /getCoachHomeActiveAthleteCount\(\)/)
  assert.match(home, /getCoachHomePlanningSummary\(\)/)
  assert.match(home, /getCoachHomeNextCompetition\(\)/)
})
