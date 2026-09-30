import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const generationExplanationSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'lib',
    'session-generation',
    'generation-explanation.ts',
  ),
  'utf8',
)
const adjustmentSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'app',
    'actions',
    'athlete-session-adjustment-actions.ts',
  ),
  'utf8',
)
const sessionActionsSource = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'session-actions.ts'),
  'utf8',
)
const schemaSource = fs.readFileSync(
  path.join(process.cwd(), 'db', 'schema.ts'),
  'utf8',
)

test('GenerationExplanation has no athlete adjustment or realized-state authority', () => {
  const contractStart = generationExplanationSource.indexOf(
    'export interface GenerationExplanation',
  )
  const contractEnd = generationExplanationSource.indexOf(
    'export function assertValidGenerationExplanation',
    contractStart,
  )
  const contract = generationExplanationSource.slice(contractStart, contractEnd)

  assert.doesNotMatch(contract, /AthleteSessionAdjustment|athleteSessionAdjustment/)
  assert.doesNotMatch(contract, /WorkoutLog|workoutLog/)
  assert.doesNotMatch(contract, /athleteId/)
  assert.doesNotMatch(contract, /performed|completed|realized/)
})

test('AthleteSessionAdjustment stays downstream and keyed by athlete plus source prescription', () => {
  assert.match(schemaSource, /athleteSessionAdjustments/)
  assert.match(schemaSource, /athleteId:/)
  assert.match(schemaSource, /sourcePrescriptionId:/)
  assert.match(
    schemaSource,
    /uniqueIndex\('athlete_session_adjustments_athlete_prescription_unique'\)/,
  )
  assert.match(adjustmentSource, /sourcePrescriptionId/)
  assert.doesNotMatch(adjustmentSource, /generationExplanation/)
  assert.doesNotMatch(adjustmentSource, /buildGenerationExplanation/)
})

test('WorkoutLog remains realized-only and is absent from historical generation provenance loading', () => {
  const loaderStart = sessionActionsSource.indexOf(
    'export async function getSessionGenerationExplanationReview',
  )
  const loaderEnd = sessionActionsSource.indexOf(
    'export async function getSessionFormOptions',
    loaderStart,
  )
  const provenanceLoader = sessionActionsSource.slice(loaderStart, loaderEnd)

  assert.match(schemaSource, /export const workoutLogs/)
  assert.match(schemaSource, /status:/)
  assert.match(schemaSource, /performedAt:/)
  assert.match(schemaSource, /loggedAt:/)

  assert.doesNotMatch(provenanceLoader, /workoutLogs/)
  assert.doesNotMatch(provenanceLoader, /athleteSessionAdjustments/)
  assert.doesNotMatch(provenanceLoader, /athleteSessionAdjustmentRevisions/)
})

test('Session detail keeps generated provenance and athlete adjustments as separate data flows', () => {
  const pageSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'app',
      '[locale]',
      'dashboard',
      'sessions',
      '[sessionId]',
      'page.tsx',
    ),
    'utf8',
  )

  assert.match(pageSource, /getSessionGenerationExplanationReview/)
  assert.match(pageSource, /getSessionAthleteAdjustmentReview/)
  assert.match(pageSource, /generationExplanationReview/)
  assert.match(pageSource, /athleteAdjustmentReview/)

  assert.doesNotMatch(
    pageSource,
    /generationExplanationReview[\s\S]{0,300}athleteAdjustmentReview[\s\S]{0,300}GenerationExplanationView/,
  )
})
