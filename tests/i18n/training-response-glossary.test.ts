import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import en from '@/messages/en/glossary/training-response.json'
import es from '@/messages/es/glossary/training-response.json'

const REQUIRED_KEYS = [
  'title',
  'summary',
  'priority',
  'review',
  'info',
  'convergence',
  'contributor',
  'evidenceWindow',
  'insufficientData',
  'context',
] as const

describe('training response product glossary', () => {
  it('keeps English and Spanish catalogs structurally equivalent', () => {
    assert.deepEqual(
      Object.keys(en.DomainGlossary.trainingResponseReview).sort(),
      Object.keys(es.DomainGlossary.trainingResponseReview).sort(),
    )
  })

  it('contains the complete required product-help contract in both locales', () => {
    for (const messages of [en, es]) {
      const glossary = messages.DomainGlossary.trainingResponseReview
      for (const key of REQUIRED_KEYS) {
        assert.equal(typeof glossary[key], 'string')
        assert.ok(glossary[key].trim().length > 0)
      }
    }
  })

  it('keeps the priority explanation explicitly non-diagnostic', () => {
    assert.match(en.DomainGlossary.trainingResponseReview.priority, /does not diagnose/i)
    assert.match(es.DomainGlossary.trainingResponseReview.priority, /no diagnostica/i)
  })
})
