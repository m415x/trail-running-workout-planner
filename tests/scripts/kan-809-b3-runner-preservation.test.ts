import assert from 'node:assert/strict'
import test from 'node:test'
import { compactTestFailure, compactTypecheckFailure, formatPreparationFailure, tddTypecheckCommand } from '@/scripts/tdd'

test('KAN-809/B3 preserves functional and TypeScript diagnostics', () => {
  assert.match(compactTestFailure('not ok 1 - intentional failure'), /not ok 1/)
  assert.match(compactTypecheckFailure('example.ts(1,1): error TS2322: type mismatch'), /TS2322/)
  assert.match(tddTypecheckCommand().args.join(' '), /typecheck-runner/)
})

test('KAN-809/B3 preparation labels cannot impersonate functional RED/GREEN', () => {
  for (const phase of ['sync', 'input'] as const) {
    const message = formatPreparationFailure(phase, 'example failure')
    assert.match(message, /preparation failed/)
    assert.match(message, /example failure/)
    assert.doesNotMatch(message, /\b(?:RED|GREEN)\b/)
  }
})
