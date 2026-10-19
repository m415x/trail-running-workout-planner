import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTrack1000mElapsedDraft } from '@/lib/numeric/track-1000m-elapsed-draft'

test('KAN-815 1000m accepts strictly integral minutes and seconds', () => {
  assert.deepEqual(normalizeTrack1000mElapsedDraft('3', '45'), { status: 'valid', elapsedTimeSec: 225 })
  assert.deepEqual(normalizeTrack1000mElapsedDraft('3', '0'), { status: 'valid', elapsedTimeSec: 180 })
})

test('KAN-815 1000m rejects fractions, exponent, partial and out of range seconds without rounding', () => {
  for (const values of [['3.5', '0'], ['3,5', '0'], ['3', '45.5'], ['3', '45,5'], ['3', '1e1'], ['3', '60'], ['3', '-1'], ['3', ''], ['', '45']]) {
    assert.deepEqual(normalizeTrack1000mElapsedDraft(values[0], values[1]), { status: 'invalid' }, values.join(':'))
  }
})

test('KAN-815 1000m does not convert empty or zero elapsed duration into valid evidence', () => {
  assert.deepEqual(normalizeTrack1000mElapsedDraft('', ''), { status: 'invalid' })
  assert.deepEqual(normalizeTrack1000mElapsedDraft('0', '0'), { status: 'invalid' })
})
