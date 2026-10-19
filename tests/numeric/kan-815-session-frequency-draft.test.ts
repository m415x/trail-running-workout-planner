import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeFixedSessionFrequencyDraft } from '@/lib/numeric/session-frequency-draft'

test('KAN-815/A2 optional weekly session frequency keeps empty as automatic mode', () => {
  assert.deepEqual(normalizeFixedSessionFrequencyDraft(''), { status: 'empty' })
})

test('KAN-815/A2 accepts strict integer representation without coercion', () => {
  assert.deepEqual(normalizeFixedSessionFrequencyDraft('3'), { status: 'valid', value: '3' })
  assert.deepEqual(normalizeFixedSessionFrequencyDraft('5'), { status: 'valid', value: '5' })
})

test('KAN-815/A2 rejects partial parses and fractional input', () => {
  for (const raw of ['3,5', '3.5', '3abc', '1e2', '3,', '-', ' 3', '3 ']) {
    assert.deepEqual(normalizeFixedSessionFrequencyDraft(raw), { status: 'invalid' }, raw)
  }
})

test('KAN-815/A2 does not move existing 3–5 domain restriction into lexical normalizer', () => {
  assert.deepEqual(normalizeFixedSessionFrequencyDraft('2'), { status: 'valid', value: '2' })
  assert.deepEqual(normalizeFixedSessionFrequencyDraft('6'), { status: 'valid', value: '6' })
})
