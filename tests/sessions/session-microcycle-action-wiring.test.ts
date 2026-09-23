import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(path.join(process.cwd(), 'app/actions/session-actions.ts'), 'utf8')

test('both session mutations share authoritative multi-group microcycle validation', () => {
  assert.match(source, /import \{ validateSessionMicrocyclePrescriptions \} from '@\/lib\/sessions\/session-microcycle-integration'/)
  assert.match(source, /validatePrescriptionReferences\(prescriptions\.data, data\.date\)/)
  assert.equal((source.match(/validatePrescriptionReferences\(prescriptions\.data, data\.date\)/g) ?? []).length, 2)
  assert.match(source, /validateSessionMicrocyclePrescriptions\(sessionDate, prescriptions, candidatesByGroup\)/)
  assert.doesNotMatch(source, /validateSessionMicrocycleDate\(/)
})

test('edit retains generation ownership and modification audit', () => {
  assert.match(source, /generationOwnership: existingSession\.generationOwnership === 'generated'/)
  assert.match(source, /generationKey: existingSession\.sharedEventKey/)
  assert.match(source, /generationKey: previousPrescription\.generationKey/)
  assert.match(source, /tx\.insert\(sessionGenerationModificationRecords\)/)
})
