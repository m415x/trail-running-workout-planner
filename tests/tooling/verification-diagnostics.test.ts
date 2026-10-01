import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatVerificationSummary,
  type VerificationReport,
} from '@/scripts/verify'

function failedReport(output: string): VerificationReport {
  return {
    success: false,
    totalDurationMs: 50,
    results: [{
      stage: { command: 'build', label: 'Build' },
      success: false,
      exitCode: 1,
      durationMs: 50,
      output,
    }],
  }
}

test('KAN-568 falls back to the last captured lines when output has no recognizable error marker', () => {
  const summary = formatVerificationSummary(failedReport([
    'Bundler started',
    'Unexpected termination',
    'Process stopped before writing artifacts',
  ].join('\n')))

  assert.match(summary, /Unexpected termination/)
  assert.match(summary, /Process stopped before writing artifacts/)
  assert.match(summary, /Result: FAIL/)
})

test('KAN-568 limits diagnostic excerpts but preserves meaningful failures', () => {
  const output = Array.from(
    { length: 80 },
    (_, index) => `not ok ${index + 1} - regression ${index + 1}`,
  ).join('\n')
  const summary = formatVerificationSummary(failedReport(output))
  assert.match(summary, /regression 1/)
  assert.doesNotMatch(summary, /regression 80/)
  assert.ok(summary.split('\n').length < 25)
})

test('KAN-568 never emits a blank diagnostic for an empty failed process', () => {
  const summary = formatVerificationSummary(failedReport(''))
  assert.match(summary, /failed without (?:captured )?diagnostics/i)
  assert.match(summary, /Command: pn build \(exit 1\)/)
})
