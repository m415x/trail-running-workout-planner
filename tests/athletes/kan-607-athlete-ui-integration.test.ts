import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync('app/actions/realized-training-actions.ts', 'utf8')
function action(name: string, next: string) {
  const from = actions.indexOf('export async function ' + name + '(')
  const to = actions.indexOf(next, from)
  assert.ok(from >= 0 && to > from)
  return actions.slice(from, to)
}

test('KAN-703 Athlete session-state UX distinguishes DENY from an authorized empty capture', () => {
  const source = action('getManualRealizedSessionStateAction', 'export async function getCurrentAthleteRealizedTrainingRangeAction(')
  assert.match(source, /status:\s*['"]denied['"]|error:\s*['"]not_authorized['"]/)
  assert.match(source, /captured:\s*false/)
  assert.match(source, /editableInput:\s*null/)
})

test('KAN-703 Athlete range read distinguishes invalid date, access denied and authorized empty rows', () => {
  const source = action('getCurrentAthleteRealizedTrainingRangeAction', 'export interface RealizedTrainingCalendarSession')
  assert.match(source, /invalid_range|invalid_date_range/)
  assert.match(source, /status:\s*['"]denied['"]|error:\s*['"]not_authorized['"]/)
  assert.match(source, /success:\s*true/)
  assert.match(source, /listRealizedTrainingRecordsForAthleteInDateRange/)
})
