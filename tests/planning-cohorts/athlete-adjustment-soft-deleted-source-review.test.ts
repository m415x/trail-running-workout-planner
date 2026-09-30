import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const actions = read('app/actions/athlete-session-adjustment-actions.ts')

test('Coach review does not scope stale adjustments only through active session prescriptions', () => {
  assert.doesNotMatch(
    actions,
    /sessionPrescriptionIds[\s\S]{0,500}inArray\(athleteSessionAdjustments\.sourcePrescriptionId, sessionPrescriptionIds\)/,
  )
})

test('Coach can retain a stale adjustment whose source prescription is soft-deleted', () => {
  assert.match(actions, /athleteSessionAdjustments/)
  assert.match(actions, /sourcePrescriptionId/)
  assert.match(actions, /reviewRequired/)
  assert.match(actions, /outside_authority/)
})
