import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'dashboard-actions.ts'),
  'utf8',
)

test('athlete planning week resolves dated planning authority before selecting prescriptions', () => {
  assert.match(source, /resolveAthletePlanningOnDate/)
  assert.match(source, /resolveAthleteSessionPrescription/)
  assert.match(source, /groupTrainingPlanId/)
})

test('athlete planning week no longer treats groupId as sufficient prescription identity', () => {
  const functionStart = source.indexOf('export async function getCurrentAthletePlanningWeek')
  assert.notEqual(functionStart, -1)
  const functionSource = source.slice(functionStart, source.indexOf('export async function getAthleteShoes', functionStart))

  assert.doesNotMatch(
    functionSource,
    /sessionPrescriptions:\s*\{[\s\S]*eq\(groupSessionPrescriptions\.groupId,\s*athlete\.groupId\)/,
  )
})
