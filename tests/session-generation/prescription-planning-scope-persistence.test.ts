import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'session-generation-actions.ts'),
  'utf8',
)

test('generated prescription create collisions are resolved by Session + microcycle planning scope', () => {
  assert.match(
    source,
    /eq\(groupSessionPrescriptions\.sessionId,\s*sessionId\)[\s\S]*eq\(groupSessionPrescriptions\.microcycleId,\s*values\.microcycleId\)/,
  )
  assert.doesNotMatch(
    source,
    /eq\(groupSessionPrescriptions\.sessionId,\s*sessionId\)[\s\S]{0,220}eq\(groupSessionPrescriptions\.groupId,\s*values\.groupId\)/,
  )
})

test('regeneration scopes existing prescriptions to the active plan microcycles before reconciliation', () => {
  assert.match(
    source,
    /const microcycleIds = new Set\(planMicrocycles\.map\(\(\{ id \}\) => id\)\)/,
  )
  assert.match(
    source,
    /inArray\(groupSessionPrescriptions\.microcycleId, \[\.\.\.microcycleIds\]\)/,
  )
  assert.match(
    source,
    /reconcileSessionGeneration\(\{[\s\S]*existingPrescriptions: persistedPrescriptions\.map/,
  )
})

test('protected prescriptions are not overwritten by create collision handling', () => {
  assert.match(source, /samePlanningScopePrescription\.generationOwnership === 'generated'/)
  assert.doesNotMatch(
    source,
    /samePlanningScopePrescription\.generationOwnership === 'generated_modified'[\s\S]{0,300}tx\.update\(groupSessionPrescriptions\)/,
  )
  assert.doesNotMatch(
    source,
    /samePlanningScopePrescription\.generationOwnership === 'manual'[\s\S]{0,300}tx\.update\(groupSessionPrescriptions\)/,
  )
})

test('shared Session deletion checks every active prescription on the event, not only the active plan scope', () => {
  assert.match(
    source,
    /eq\(groupSessionPrescriptions\.sessionId,\s*eventId\)[\s\S]*eq\(groupSessionPrescriptions\.isDeleted,\s*false\)/,
  )
  assert.match(
    source,
    /if \(!active\) \{[\s\S]*tx\.update\(sessions\)\.set\(\{ isDeleted: true/,
  )
})
