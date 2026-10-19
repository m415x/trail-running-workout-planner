import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTemplateReferencePercentageDraft } from '@/lib/numeric/template-reference-percentage-draft'

test('KAN-815 accepts comma and point as a single-decimal reference percentage', () => {
  assert.deepEqual(normalizeTemplateReferencePercentageDraft('75,5'), { status: 'valid', value: '75.5' })
  assert.deepEqual(normalizeTemplateReferencePercentageDraft('75.5'), { status: 'valid', value: '75.5' })
  assert.deepEqual(normalizeTemplateReferencePercentageDraft('100'), { status: 'valid', value: '100' })
})

test('KAN-815 distinguishes empty and rejects malformed reference percentages', () => {
  assert.deepEqual(normalizeTemplateReferencePercentageDraft(''), { status: 'empty' })
  for (const raw of ['75,', '75,55', '1.234,5', '75%', '1e2']) {
    assert.deepEqual(normalizeTemplateReferencePercentageDraft(raw), { status: 'invalid' }, raw)
  }
})

test('KAN-815 leaves intensity range rules to domain validation', () => {
  assert.deepEqual(normalizeTemplateReferencePercentageDraft('0'), { status: 'valid', value: '0' })
  assert.deepEqual(normalizeTemplateReferencePercentageDraft('201'), { status: 'valid', value: '201' })
})
