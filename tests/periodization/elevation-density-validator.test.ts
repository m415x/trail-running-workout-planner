import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assessElevationDensity } from '@/lib/periodization/elevation-density-validator'

describe('densidad vertical', () => {
  it('distingue recorridos corribles y estándar sin advertencias', () => {
    assert.deepEqual(assessElevationDensity(40, 800), {
      metersPerKm: 20,
      level: 'runnable',
      warning: null,
    })
    assert.deepEqual(assessElevationDensity(40, 1_600), {
      metersPerKm: 40,
      level: 'standard',
      warning: null,
    })
  })

  it('advierte una combinación de montaña con densidad alta', () => {
    const result = assessElevationDensity(20, 2_000)

    assert.equal(result.metersPerKm, 100)
    assert.equal(result.level, 'high')
    assert.match(result.warning ?? '', /objetivo de montaña deliberado/)
  })

  it('distingue una combinación extrema sin bloquearla', () => {
    const result = assessElevationDensity(10, 2_000)

    assert.equal(result.metersPerKm, 200)
    assert.equal(result.level, 'extreme')
    assert.match(result.warning ?? '', /Verificá/)
  })

  it('rechaza valores estructuralmente inválidos', () => {
    assert.throws(() => assessElevationDensity(0, 500), /mayor que cero/)
    assert.throws(() => assessElevationDensity(10, 500.5), /entero no negativo/)
    assert.throws(() => assessElevationDensity(10, -1), /entero no negativo/)
  })
})
