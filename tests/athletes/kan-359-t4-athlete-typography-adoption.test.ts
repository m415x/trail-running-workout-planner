import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-359/T4 Athlete Home greeting adopts responsive heading token without changing business data', () => {
  const home = read('features/workouts/components/HomeHeader.tsx')
  assert.match(home, /--athlete-text-heading/)
  assert.match(home, /t\('greeting', \{ name: displayName \}\)/)
  assert.match(home, /useHomeHeader\(presentationLocale\)/)
})

test('KAN-359/T4 Athlete Stats heading and metric hierarchy use scoped semantic typography', () => {
  const stats = read('app/[locale]/(mobile)/stats/page.tsx')
  assert.match(stats, /--athlete-text-heading/)
  assert.match(stats, /--athlete-text-title/)
  assert.match(stats, /--athlete-text-data/)
  assert.match(stats, /buildAthleteStatsSummaryView\(result\.data\)/)
  assert.match(stats, /getCurrentAthleteStatsAction/)
})

test('KAN-359/T4 Athlete navigation labels use scoped caption size and retain keyboard focus contract', () => {
  const nav = read('components/layout/BottomNavigationBar.tsx')
  assert.match(nav, /--athlete-text-caption/)
  assert.match(nav, /focus-visible:ring-2/)
  assert.match(nav, /NAV_ITEMS\.map/)
})

test('KAN-359/T4 Plan retains existing semantic content and inherits typography without editing planning behavior', () => {
  const plan = read('app/[locale]/(mobile)/plan/page.tsx')
  const shell = read('components/layout/MobileShell.tsx')
  const css = read('features/athlete-typography/typography.css')
  assert.match(plan, /getCurrentAthletePlanningPeriod\(/)
  assert.match(plan, /resolveSelectedAthletePlanWeek\(/)
  assert.match(plan, /selectEffectiveAthletePlanWeek\(/)
  assert.match(plan, /projectAthletePlannedWeeklyVolume\(/)
  assert.match(plan, /readAthletePlanCompetitionMilestones\(/)
  assert.match(plan, /--athlete-text-heading/)
  assert.match(plan, /<AthleteSessionCard/)
  assert.match(plan, /t\('currentWeek'\)/)
  assert.match(shell, /className='athlete-typography/)
  assert.match(css, /\.athlete-typography\s*\{/)
  assert.doesNotMatch(css, /(?:^|[},\n])\s*(?:html|body|:root)\s*\{/m)
})
