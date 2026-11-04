import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync('app/[locale]/dashboard/layout.tsx', 'utf8')
const shell = readFileSync('app/[locale]/dashboard/DashboardShell.tsx', 'utf8')
const home = readFileSync('app/[locale]/dashboard/page.tsx', 'utf8')

test('KAN-869/T6 Team switch changes the identity of the mounted Coach Home UI', () => {
  assert.match(layout, /createActiveTeamNextServerContext|resolve.*ActiveTeam/,
    'Dashboard server layout must resolve the actual H3 Team server-side')
  assert.match(layout, /key=\{[^}]*team/i,
    'Switching Team must remount the Home data state (or explicitly revalidate it)')
  assert.match(shell, /(?:teamKey|activeTeamId)/,
    'A server-owned active Team key must reach the component boundary')
})

test('KAN-869/T6 async Home data must reset on identity switch, not retain previous Team results', () => {
  assert.match(home, /setAthletes\(\{ status: 'loading' \}\)/)
  assert.match(home, /setPlanning\(\{ status: 'loading' \}\)/)
  assert.match(home, /setCompetition\(\{ status: 'loading' \}\)/)
  assert.match(home, /getCoachHomeActiveAthleteCount\(\)/)
  assert.match(home, /getCoachHomePlanningSummary\(\)/)
  assert.match(home, /getCoachHomeNextCompetition\(\)/)
})
