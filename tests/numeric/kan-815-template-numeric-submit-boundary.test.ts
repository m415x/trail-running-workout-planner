import assert from 'node:assert/strict'
import test from 'node:test'
import { submitValidatedTemplateNumericDraft } from '@/lib/numeric/template-numeric-submit-boundary'

function data(fields: Record<string, string>) {
  const result = new FormData()
  for (const [key, value] of Object.entries(fields)) result.set(key, value)
  return result
}

test('KAN-815 template submission canonicalizes metrics and active reference percentage', () => {
  const form = data({ distanceKm: '12,5', durationMin: '60', elevationGain: '', referencePercentage: '75,5' })
  let writes = 0
  const result = submitValidatedTemplateNumericDraft(form, 'reference_percentage', (payload) => {
    writes++
    assert.equal(payload.get('distanceKm'), '12.5')
    assert.equal(payload.get('durationMin'), '60')
    assert.equal(payload.get('elevationGain'), '')
    assert.equal(payload.get('referencePercentage'), '75.5')
  })
  assert.equal(result, 'submitted')
  assert.equal(writes, 1)
})

test('KAN-815 invalid metric blocks callback and does not mutate incoming FormData', () => {
  const form = data({ distanceKm: '12,5', durationMin: '60,5', elevationGain: '', referencePercentage: '75,5' })
  let writes = 0
  assert.equal(submitValidatedTemplateNumericDraft(form, 'reference_percentage', () => { writes++ }), 'invalid')
  assert.equal(writes, 0)
  assert.equal(form.get('distanceKm'), '12,5')
  assert.equal(form.get('durationMin'), '60,5')
})

test('KAN-815 inactive reference percentage does not become required', () => {
  const form = data({ distanceKm: '', durationMin: '', elevationGain: '', referencePercentage: 'bad' })
  let writes = 0
  assert.equal(submitValidatedTemplateNumericDraft(form, 'hr_zone', () => { writes++ }), 'submitted')
  assert.equal(writes, 1)
})

test('KAN-815 invalid active reference percentage blocks callback', () => {
  const form = data({ distanceKm: '', durationMin: '', elevationGain: '', referencePercentage: '75,' })
  let writes = 0
  assert.equal(submitValidatedTemplateNumericDraft(form, 'reference_percentage', () => { writes++ }), 'invalid')
  assert.equal(writes, 0)
})
