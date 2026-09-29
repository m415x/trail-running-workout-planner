import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'dashboard-actions.ts'),
  'utf8',
)

test('athlete planning week resolves individual adjustment only after the effective audience prescription', () => {
  const functionStart = source.indexOf('export async function getCurrentAthletePlanningWeek')
  assert.notEqual(functionStart, -1)
  const functionSource = source.slice(
    functionStart,
    source.indexOf('export async function getAthleteShoes', functionStart),
  )

  const prescriptionResolution = functionSource.indexOf('resolveAthleteSessionPrescription')
  const adjustmentResolution = functionSource.indexOf('resolveEffectiveAthleteAdjustment')
  const plannedSessionResolution = functionSource.indexOf('resolveAthletePlannedSession')

  assert.ok(prescriptionResolution >= 0)
  assert.ok(adjustmentResolution > prescriptionResolution)
  assert.ok(plannedSessionResolution > adjustmentResolution)
})

test('athlete planning week loads adjustments by athlete and exact effective source prescription ids', () => {
  const functionStart = source.indexOf('export async function getCurrentAthletePlanningWeek')
  const functionSource = source.slice(
    functionStart,
    source.indexOf('export async function getAthleteShoes', functionStart),
  )

  assert.match(functionSource, /athleteSessionAdjustments/)
  assert.match(functionSource, /athleteSessionAdjustmentRevisions/)
  assert.match(functionSource, /sourcePrescriptionId/)
  assert.match(functionSource, /inArray\(athleteSessionAdjustments\.sourcePrescriptionId/)
  assert.match(functionSource, /eq\(athleteSessionAdjustments\.athleteId, athlete\.id\)/)
  assert.match(functionSource, /eq\(athleteSessionAdjustmentRevisions\.isCurrent, true\)/)
})

test('athlete planning week never uses WorkoutLog as planned individual state', () => {
  const functionStart = source.indexOf('export async function getCurrentAthletePlanningWeek')
  const functionSource = source.slice(
    functionStart,
    source.indexOf('export async function getAthleteShoes', functionStart),
  )

  assert.doesNotMatch(functionSource, /workoutLogs|workout_logs|WorkoutLog/)
})
