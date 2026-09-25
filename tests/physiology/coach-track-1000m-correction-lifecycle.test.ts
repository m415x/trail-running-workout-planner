import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const application = readFileSync('lib/physiology/field-performance-test-application.ts', 'utf8')
const form = readFileSync('features/field-performance-test/components/CoachTrack1000mForm.tsx', 'utf8')

test('coach correction keeps self-directed replacement accepted', () => {
  const start = application.indexOf('export async function correctTrack1000mEvidence')
  const end = application.indexOf('export interface ReviewCoachTrack1000mEvidenceInput', start)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  const correction = application.slice(start, end)
  assert.match(correction, /reviewStatus:\s*'accepted'/)
})

test('coach 1000m lists present elapsed time as min:sec instead of total seconds', () => {
  assert.match(form, /formatElapsedTime/)
  assert.doesNotMatch(form, /\{item\.elapsedTimeSec\} s/)
})
