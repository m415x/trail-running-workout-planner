import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateMacrocycleHorizon } from '@/lib/periodization/macrocycle-horizon'

describe('horizonte del macrociclo', () => {
  it('acepta un período de doce semanas y calcula su duración', () => {
    const result = validateMacrocycleHorizon({
      startDate: '2026-01-05',
      endDate: '2026-03-29',
    })

    assert.equal(result.isValid, true)
    assert.equal(result.durationDays, 84)
    assert.equal(result.durationWeeks, 12)
  })

  it('rechaza fechas inválidas o invertidas', () => {
    assert.equal(validateMacrocycleHorizon({
      startDate: '2026-02-30',
      endDate: '2026-03-29',
    }).isValid, false)

    assert.equal(validateMacrocycleHorizon({
      startDate: '2026-03-29',
      endDate: '2026-01-05',
    }).isValid, false)
  })

  it('exige al menos cuatro semanas completas', () => {
    const shortHorizon = validateMacrocycleHorizon({
      startDate: '2026-01-05',
      endDate: '2026-01-25',
    })
    const minimumHorizon = validateMacrocycleHorizon({
      startDate: '2026-01-05',
      endDate: '2026-02-01',
    })

    assert.equal(shortHorizon.isValid, false)
    assert.equal(minimumHorizon.isValid, true)
    assert.equal(minimumHorizon.durationWeeks, 4)
  })
})
