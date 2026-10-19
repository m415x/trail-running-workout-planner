import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRegionalNumericInput } from '@/lib/numeric/regional-numeric-input'

test('KAN-814/A1 accepts comma or point decimals without rounding', () => {
  for (const raw of ['70,5', '70.5']) {
    assert.deepEqual(parseRegionalNumericInput(raw, { kind: 'decimal', maxFractionDigits: 1 }), {
      status: 'valid',
      value: 70.5,
    })
  }
  assert.deepEqual(parseRegionalNumericInput('70', { kind: 'decimal', maxFractionDigits: 1 }), {
    status: 'valid',
    value: 70,
  })
})

test('KAN-814/A1 preserves absence and editing intermediate states', () => {
  assert.deepEqual(parseRegionalNumericInput('', { kind: 'decimal', maxFractionDigits: 1 }), {
    status: 'empty',
  })
  for (const raw of ['-', ',', '.', '70,', '70.']) {
    assert.deepEqual(parseRegionalNumericInput(raw, { kind: 'decimal', maxFractionDigits: 1 }), {
      status: 'editing',
    })
  }
})

test('KAN-814/A1 rejects mixed separators, excessive precision and partial parses', () => {
  for (const raw of ['70,5.2', '1.234,5', '1,234.5', '70,55', '70.55', '70abc', '1e2', ' 70kg']) {
    assert.deepEqual(parseRegionalNumericInput(raw, { kind: 'decimal', maxFractionDigits: 1 }), {
      status: 'invalid',
    }, raw)
  }
})

test('KAN-814/A1 enforces strict integer syntax independently of domain ranges', () => {
  assert.deepEqual(parseRegionalNumericInput('42', { kind: 'integer' }), {
    status: 'valid',
    value: 42,
  })
  for (const raw of ['42,5', '42.5', '42abc', '1e2']) {
    assert.deepEqual(parseRegionalNumericInput(raw, { kind: 'integer' }), {
      status: 'invalid',
    }, raw)
  }
  assert.deepEqual(parseRegionalNumericInput('-2', { kind: 'integer' }), {
    status: 'valid',
    value: -2,
  })
})

test('KAN-814/A1 never coalesces invalid, empty or editing states to zero', () => {
  const options = { kind: 'decimal' as const, maxFractionDigits: 2 }
  assert.deepEqual(parseRegionalNumericInput('0,00', options), { status: 'valid', value: 0 })
  assert.deepEqual(parseRegionalNumericInput('', options), { status: 'empty' })
  assert.deepEqual(parseRegionalNumericInput('1,', options), { status: 'editing' })
  assert.deepEqual(parseRegionalNumericInput('1,234', options), { status: 'invalid' })
})
