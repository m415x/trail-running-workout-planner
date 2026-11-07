import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('app/[locale]/dashboard/page.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/common/coach-shell.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en/common/coach-shell.json', 'utf8'))

test('KAN-869/T6 Coach Home never displays raw YYYY-MM-DD dates instead of regional presentation', () => {
  assert.doesNotMatch(home, /date:\s*competition\.competition\.date/,
    'Competition date needs a regional formatter, not raw ISO storage format')
  assert.doesNotMatch(home, /start:\s*week\.startDate,\s*end:\s*week\.endDate/,
    'Microcycle date range must be formatted for the active presentation locale')
  assert.match(home, /Intl\.DateTimeFormat|formatCoachHomeDate/,
    'The Home must use an explicit locale-aware date presentation boundary')
})

test('KAN-869/T6 both locales cover Coach Home states and do not show stale fictitious claims', () => {
  for (const messages of [es, en]) {
    assert.equal(typeof messages.CoachHome.planning.states.denied, 'string')
    assert.equal(typeof messages.CoachHome.planning.states.error, 'string')
    assert.equal(typeof messages.CoachHome.competition.states.empty, 'string')
    assert.equal(typeof messages.CoachHome.athleteStates.selection_required, 'string')
  }
  assert.doesNotMatch(home, /\$1,250|85% de membresías|Atletas con sobrecarga|coach@trailrun\.com/)
})

test('KAN-869/T6 navigable Home uses capability-projected links and keyboard-visible focus', () => {
  assert.match(home, /selectCoachSidebarDestinations\(visibleDestinations\)/)
  assert.match(home, /destinations\.has\('\/dashboard\/planning'\)/)
  assert.match(home, /focus-visible:ring-2/)
  assert.doesNotMatch(home, /href=\{?['"]\/dashboard\/competitions['"]/)
})
