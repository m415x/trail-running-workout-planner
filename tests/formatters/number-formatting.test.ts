import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatNumber } from '@/lib/formatters'

describe('formatNumber', () => {
  it('formats numbers from an explicit presentation locale', () => {
    assert.equal(formatNumber(1234567.89, 'es-AR'), '1.234.567,89')
    assert.equal(formatNumber(1234567.89, 'en-US'), '1,234,567.89')
  })

  it('does not accept or infer currency as part of generic number formatting', () => {
    assert.equal(formatNumber(25000, 'en-US'), '25,000')
  })
})
