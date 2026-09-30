import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'session-generation-actions.ts'),
  'utf8',
)

test('generation explanations travel separately from the planning proposal', () => {
  assert.match(
    source,
    /formData\.get\('generationExplanations'\)/,
  )
  assert.match(
    source,
    /parseGenerationExplanationSnapshots/,
  )

  const reconciliationStart = source.indexOf('const reconciliation = reconcileSessionGeneration')
  assert.notEqual(reconciliationStart, -1)
  const reconciliationEnd = source.indexOf('})', reconciliationStart)
  const reconciliationSource = source.slice(reconciliationStart, reconciliationEnd + 2)

  assert.doesNotMatch(reconciliationSource, /generationExplanation/)
  assert.doesNotMatch(reconciliationSource, /generationExplanations/)
})

test('historical snapshots are validated against the persisted planning scope', () => {
  assert.match(
    source,
    /planningCohortId:\s*groupTrainingPlans\.planningCohortId/,
  )
  assert.match(
    source,
    /resolveGenerationExplanationSnapshot\(\{[\s\S]*generationKey:[\s\S]*expectedScope:/,
  )
  assert.match(
    source,
    /kind:\s*plan\.planningCohortId\s*===\s*null\s*\?\s*'base'\s*:\s*'variant'/,
  )
  assert.match(
    source,
    /groupTrainingPlanId:\s*planId/,
  )
  assert.match(
    source,
    /groupId:\s*plan\.groupId/,
  )
  assert.match(
    source,
    /planningCohortId:\s*plan\.planningCohortId/,
  )
  assert.match(
    source,
    /microcycleId:\s*values\.microcycleId/,
  )
})

test('only generated prescription create/update audit records receive the structured snapshot', () => {
  assert.match(
    source,
    /insertPrescriptionAudit\(tx, \{[\s\S]*action:\s*'generated_created'[\s\S]*generationExplanation:/,
  )
  assert.match(
    source,
    /insertPrescriptionAudit\(tx, \{[\s\S]*action:\s*'generated_updated'[\s\S]*generationExplanation:/,
  )

  assert.match(
    source,
    /generationExplanation:\s*values\.action\s*===\s*'generated_removed'[\s\S]*\?\s*null[\s\S]*:\s*values\.generationExplanation/,
  )

  const eventAuditInsert = source.indexOf(
    'tx.insert(sessionGenerationModificationRecords).values({',
  )
  assert.notEqual(eventAuditInsert, -1)
  const eventAuditEnd = source.indexOf('}).run()', eventAuditInsert)
  const eventAuditSource = source.slice(eventAuditInsert, eventAuditEnd)
  assert.doesNotMatch(eventAuditSource, /generationExplanation:/)

  const removedPrescriptionCall = source.match(
    /insertPrescriptionAudit\(tx, \{[\s\S]*?action:\s*'generated_removed'[\s\S]*?\}\)/,
  )?.[0]
  assert.ok(removedPrescriptionCall)
  assert.doesNotMatch(removedPrescriptionCall, /generationExplanation:/)
})

test('prescription audit writes the snapshot to the append-only audit row only', () => {
  assert.match(
    source,
    /generationExplanation:\s*GenerationExplanation\s*\|\s*null/,
  )
  assert.match(
    source,
    /tx\.insert\(sessionGenerationModificationRecords\)\.values\(\{[\s\S]*generationExplanation:\s*values\.action\s*===\s*'generated_removed'[\s\S]*\?\s*null[\s\S]*:\s*values\.generationExplanation/,
  )

  const prescriptionRecordStart = source.indexOf('const record = {')
  assert.notEqual(prescriptionRecordStart, -1)
  const prescriptionRecordEnd = source.indexOf('}', prescriptionRecordStart)
  const prescriptionRecordSource = source.slice(
    prescriptionRecordStart,
    prescriptionRecordEnd + 1,
  )
  assert.doesNotMatch(prescriptionRecordSource, /generationExplanation/)
})
