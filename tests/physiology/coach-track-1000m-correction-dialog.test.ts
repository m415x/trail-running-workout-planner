import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(
  'features/field-performance-test/components/CoachTrack1000mForm.tsx',
  'utf8',
)

test('coach 1000m correction refreshes the visible history after success', () => {
  const start = source.indexOf('async function correct')
  const end = source.indexOf('async function review', start)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  const correction = source.slice(start, end)
  assert.match(correction, /if \(result\.success\) \{[\s\S]*?router\.refresh\(\)/)
})

test('coach 1000m correction uses an AlertDialog with minute and second fields', () => {
  assert.doesNotMatch(source, /window\.prompt/)
  assert.match(source, /AlertDialog/)
  assert.match(source, /correctionMinutes/)
  assert.match(source, /correctionSeconds/)
})
