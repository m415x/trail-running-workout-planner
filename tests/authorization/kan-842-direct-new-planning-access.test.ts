import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const newPage = readFileSync('app/[locale]/dashboard/planning/new/page.tsx', 'utf8')
const writer = readFileSync('app/actions/load-strategy-actions.ts', 'utf8')

test('KAN-842/T3 direct New Strategy URL requires server-side creation eligibility', () => {
  assert.match(newPage, /getCoachPlanningCreationEligibility/)
  assert.match(newPage, /canCreateStrategy|creationAllowed/)
  assert.match(newPage, /if \(!(?:canCreateStrategy|creationAllowed)\)/)
  assert.match(writer, /export async function createGroupPlanWithLoadStrategy\(/)
  assert.match(writer, /capability: 'planning\.manage'/)
})

test('KAN-842/T3 direct URL authorization precedes rendering LoadStrategyForm', () => {
  const eligibility = newPage.indexOf('getCoachPlanningCreationEligibility(')
  const form = newPage.indexOf('<LoadStrategyForm')
  assert.ok(eligibility >= 0 && form > eligibility)
  assert.match(newPage.slice(eligibility, form), /if \(!(?:canCreateStrategy|creationAllowed)\)/)
})
