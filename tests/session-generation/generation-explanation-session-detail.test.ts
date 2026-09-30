import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const actionSource = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'session-actions.ts'),
  'utf8',
)
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

test('Session detail loader reads persisted generation provenance instead of recomputing it', () => {
  assert.match(
    actionSource,
    /export async function getSessionGenerationExplanationReview\(sessionId: string\)/,
  )
  assert.match(actionSource, /sessionGenerationModificationRecords/)
  assert.match(actionSource, /generationExplanation/)
  assert.match(actionSource, /prescriptionId/)
  assert.match(actionSource, /groupSessionPrescriptions\.generationOwnership/)
  assert.match(actionSource, /groupSessionPrescriptions\.generationKey/)
  assert.doesNotMatch(
    actionSource.slice(
      actionSource.indexOf('export async function getSessionGenerationExplanationReview'),
      actionSource.indexOf('export async function getSessionFormOptions'),
    ),
    /buildGenerationExplanation|generateWeeklySessionProposals/,
  )
})

test('Session detail provenance resolves the latest persisted snapshot per active prescription', () => {
  const start = actionSource.indexOf(
    'export async function getSessionGenerationExplanationReview',
  )
  assert.notEqual(start, -1)
  const end = actionSource.indexOf(
    'export async function getSessionFormOptions',
    start,
  )
  const loader = actionSource.slice(start, end)

  assert.match(loader, /eq\(groupSessionPrescriptions\.sessionId, sessionId\)/)
  assert.match(loader, /eq\(groupSessionPrescriptions\.isDeleted, false\)/)
  assert.match(loader, /inArray\(sessionGenerationModificationRecords\.prescriptionId/)
  assert.match(loader, /isNotNull\(sessionGenerationModificationRecords\.generationExplanation\)/)
  assert.match(loader, /desc\(sessionGenerationModificationRecords\.createdAt\)/)
  assert.match(loader, /seenPrescriptionIds/)
})

test('Session detail presents generation provenance separately from athlete adjustments', () => {
  assert.match(pageSource, /getSessionGenerationExplanationReview/)
  assert.match(pageSource, /generationExplanationReview/)
  assert.match(pageSource, /t\('routes\.detail\.generationReview\.title'\)/)
  assert.match(pageSource, /generationOwnership/)
  assert.match(pageSource, /planningScope/)
  assert.match(pageSource, /AthleteSessionAdjustmentReview/)

  const provenanceIndex = pageSource.indexOf('generationExplanationReview')
  const adjustmentsIndex = pageSource.indexOf('<AthleteSessionAdjustmentReview')
  assert.ok(provenanceIndex >= 0)
  assert.ok(adjustmentsIndex >= 0)
  assert.notEqual(provenanceIndex, adjustmentsIndex)
})

test('Session detail does not present a generated explanation when no historical snapshot exists', () => {
  assert.match(
    pageSource,
    /generationExplanationReview\.length\s*>\s*0/,
  )
  assert.match(
    pageSource,
    /t\('routes\.detail\.generationReview\.empty'\)/,
  )
})
