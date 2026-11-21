import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { assertVerticalEditElevationConsistency } from '../../lib/sessions/session-vertical-edit-fields'

const complete = JSON.stringify({
  schemaVersion: 1,
  direction: 'ascent',
  repetitions: 2,
  coverage: 'complete',
  elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
})

test('KAN-879 RED-6 explicit vertical block changes are checked even when the session D+ is unchanged', () => {
  assert.throws(() => assertVerticalEditElevationConsistency({
    previousElevationGain: 900,
    nextElevationGain: 900,
    verticalBlockJson: complete,
    verticalBlockExplicitlyChanged: true,
  }), /complete|elevation|vertical/i,
  'Changing a complete block to 2×400 while retaining D+=900 must fail closed')

  assert.doesNotThrow(() => assertVerticalEditElevationConsistency({
    previousElevationGain: 900,
    nextElevationGain: 900,
    verticalBlockJson: complete,
  }), 'Unchanged legacy-only fields preserve previously stored data without reinterpretation')
})

test('KAN-879 RED-6 updateSession checks final vertical dose before any durable writes', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  assert.match(source,
    /import \{[^}]*assertVerticalEditElevationConsistency[^}]*\} from ['"]@\/lib\/sessions\/session-vertical-edit-fields['"]/,
    'The actual Server Action must import the final-dose consistency guard')

  const start = source.indexOf('export async function updateSession(')
  const end = source.indexOf('function validatePrescriptionReferences(', start)
  assert.ok(start >= 0 && end > start)
  const update = source.slice(start, end)
  const authorized = update.indexOf('mutate: () => db.transaction((tx) => {')
  const validation = update.indexOf('assertVerticalEditElevationConsistency(')
  const sessionUpdate = update.indexOf('tx.update(sessions)')
  const prescriptionsUpdate = update.indexOf('tx.insert(groupSessionPrescriptions)')
  assert.ok(authorized >= 0 && validation > authorized, 'Guard must run inside the authorized mutation transaction')
  assert.ok(validation < sessionUpdate && validation < prescriptionsUpdate,
    'Guard must reject contradictory final D+ before updating the Session or prescriptions')
  const validationSource = update.slice(validation, validation + 500)
  assert.match(validationSource, /previousElevationGain:\s*previousPrescription\?\.elevationGain\s*\?\?\s*null/,
    'Compare against the same Session + microcycle previous D+')
  assert.match(validationSource, /nextElevationGain:\s*prescription\.elevationGain/,
    'Check the submitted final whole-session D+')
  assert.match(validationSource, /verticalBlockJson:\s*verticalFields\.verticalBlockJson/,
    'Check the effective retained/replaced block, not only form fields')
  assert.match(validationSource, /verticalBlockExplicitlyChanged:\s*prescription\.verticalBlock\s*!==\s*undefined/,
    'Explicit block replacements must be checked even when D+ is unchanged')
})
