import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const athlete = readFileSync('features/field-performance-test/components/AthleteTrack1000mForm.tsx', 'utf8')
const coach = readFileSync('features/field-performance-test/components/CoachTrack1000mForm.tsx', 'utf8')

test('KAN-815/A2 athlete and coach submit strictly parsed 1000m elapsed time', () => {
  for (const source of [athlete, coach]) {
    assert.match(source, /normalizeTrack1000mElapsedDraft/)
    assert.doesNotMatch(source, /Number\(minutes\) \* 60 \+ Number\(seconds\)/)
    assert.match(source, /type='text' inputMode='numeric'/)
  }
})

test('KAN-815/A2 correction also validates strict integer elapsed time before server action', () => {
  assert.doesNotMatch(coach, /Number\(correctionMinutes\) \* 60 \+ Number\(correctionSeconds\)/)
  assert.match(coach, /normalizeTrack1000mElapsedDraft\(correctionMinutes, correctionSeconds\)/)
  assert.match(coach, /hasCorrectionTime/)
  assert.match(coach, /correctTrack1000mEvidenceAction/)
})

test('KAN-815/A2 invalid draft is blocked before each write action', () => {
  assert.match(athlete, /if \(elapsedDraft\.status !== 'valid'\) return/)
  assert.match(coach, /if \(elapsedDraft\.status !== 'valid'\) return/)
  assert.match(coach, /if \(correctionDraft\.status !== 'valid'\) return/)
})
