import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'actions', 'session-actions.ts'),
  'utf8',
)

test('manual Session updates preserve prescription identity by Session + microcycle', () => {
  const functionStart = source.indexOf('export async function updateSession')
  assert.notEqual(functionStart, -1)
  const functionSource = source.slice(functionStart, source.indexOf('function validatePrescriptionReferences', functionStart))

  assert.match(
    functionSource,
    /new Map\(existingPrescriptions\.map\(\(prescription\) => \[\s*prescription\.microcycleId,/,
  )
  assert.match(
    functionSource,
    /existingPrescriptions\.find\(\s*\(existing\) => existing\.microcycleId === prescription\.microcycleId/,
  )
  assert.match(
    functionSource,
    /target: \[groupSessionPrescriptions\.sessionId, groupSessionPrescriptions\.microcycleId\]/,
  )
  assert.doesNotMatch(
    functionSource,
    /target: \[groupSessionPrescriptions\.sessionId, groupSessionPrescriptions\.groupId\]/,
  )
})
