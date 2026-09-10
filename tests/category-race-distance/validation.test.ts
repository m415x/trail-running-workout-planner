import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateRaceDistanceForCategory as validate } from '@/lib/validate-race-distance-for-category'
import { CATEGORY_RACE_DISTANCE_POLICY, DEFAULT_CATEGORY_RACE_DISTANCE_POLICY_OPTIONS } from '@/lib/category-race-distance-policy'
import type { CategoryRaceDistancePolicyOptions } from '@/types/athlete/category-race-distance.types'

describe('compatibilidad de distancia competitiva', () => {
  it('incluye extremos originales y tolerados, incluso distancias decimales', () => {
    for (const [category, distances] of [
      ['S', [4.5, 5, 15, 16.5]], ['H', [13.5, 15, 21, 21.0975, 23.1]],
      ['M', [18.9, 21, 42, 42.195, 46, 46.2]], ['U', [37.8, 42, 42.195, 1000]],
    ] as const) for (const distance of distances) {
      assert.equal(validate(category, distance).status, 'compatible', `${category}/${distance}`)
    }
  })
  it('advierte fuera de cada extremo sin bloquear ni redondear', () => {
    for (const [category, distance, direction] of [
      ['S', 4.499, 'below_minimum'], ['S', 16.501, 'above_maximum'],
      ['H', 13.499, 'below_minimum'], ['H', 23.101, 'above_maximum'],
      ['M', 18.899, 'below_minimum'], ['M', 46.201, 'above_maximum'],
      ['U', 37.799, 'below_minimum'], ['U', 10, 'below_minimum'], ['H', 50, 'above_maximum'],
    ] as const) {
      const result = validate(category, distance)
      assert.equal(result.status, 'incompatible')
      assert.equal(result.blocking, false)
      assert.ok('direction' in result)
      assert.equal(result.direction, direction)
    }
    assert.equal(validate('S', 16.5 + 1e-10).status, 'incompatible')
  })
  it('distingue E sin restricción de B pendiente', () => {
    assert.deepEqual(validate('E', 100), { status: 'unrestricted', blocking: false })
    assert.deepEqual(validate('B', 10), { status: 'policy_not_defined', blocking: false })
  })
  it('rechaza distancia inválida para todas las categorías sin coerción', () => {
    for (const category of Object.keys(CATEGORY_RACE_DISTANCE_POLICY)) {
      for (const distance of [0, -1, NaN, Infinity, -Infinity, '21', '', false, {}]) {
        assert.deepEqual(validate(category, distance), { status: 'invalid', blocking: true, reason: 'distance' })
      }
    }
  })
  it('rechaza categorías desconocidas y propiedades heredadas', () => {
    for (const category of ['S2', 's', 'X', 'toString', '__proto__', null, undefined, 1]) {
      assert.deepEqual(validate(category, 10), { status: 'invalid', blocking: true, reason: 'category' })
    }
  })
  it('considera null y undefined como contexto competitivo ausente', () => {
    for (const category of Object.keys(CATEGORY_RACE_DISTANCE_POLICY)) {
      for (const distance of [null, undefined]) {
        assert.deepEqual(validate(category, distance), { status: 'not_applicable', blocking: false })
      }
    }
  })
  it('permite ajustar y desactivar tolerancia sin mutaciones', () => {
    const before = JSON.stringify(CATEGORY_RACE_DISTANCE_POLICY)
    const options = Object.freeze({ tolerancePercent: 0 })
    assert.equal(validate('S', 15, options).status, 'compatible')
    assert.equal(validate('S', 15.001, options).status, 'incompatible')
    assert.equal(validate('M', 42.195, options).status, 'incompatible')
    assert.equal(validate('S', 18, { tolerancePercent: 20 }).status, 'compatible')
    assert.equal(validate('S', 18).status, 'incompatible')
    assert.equal(JSON.stringify(CATEGORY_RACE_DISTANCE_POLICY), before)
    assert.equal(DEFAULT_CATEGORY_RACE_DISTANCE_POLICY_OPTIONS.tolerancePercent, 10)
  })
  it('rechaza configuración inválida incluso sin carrera o con E/B', () => {
    for (const options of [null, {}, { tolerancePercent: -1 }, { tolerancePercent: 100 },
      { tolerancePercent: Infinity }, { tolerancePercent: NaN }, { tolerancePercent: '10' }]) {
      for (const category of ['E', 'B', 'S']) {
        assert.deepEqual(validate(category, null, options as CategoryRaceDistancePolicyOptions),
          { status: 'invalid', blocking: true, reason: 'tolerance' })
      }
    }
  })
  it('preserva rangos base y no acumula tolerancia en evaluaciones repetidas', () => {
    const first = validate('M', 42.195)
    assert.ok('minKm' in first)
    assert.equal(first.minKm, 21)
    assert.equal(first.maxKm, 42)
    assert.equal(first.direction, null)
    assert.deepEqual(validate('M', 42.195), first)
    const ultra = validate('U', 100)
    assert.ok('effectiveMaxKm' in ultra)
    assert.equal(ultra.effectiveMaxKm, null)
  })
})
