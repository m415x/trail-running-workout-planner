import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { determineMicrocycleLoadFocus } from '@/lib/periodization/microcycle-load-focus'

describe('foco principal del microciclo', () => {
  it('diferencia adaptación, volumen, montaña y recuperación', () => {
    assert.equal(determineMicrocycleLoadFocus('base'), 'balanced')
    assert.equal(determineMicrocycleLoadFocus('development'), 'volume')
    assert.equal(determineMicrocycleLoadFocus('shock'), 'elevation')
    assert.equal(determineMicrocycleLoadFocus('deload'), 'recovery')
  })

  it('distingue taper y carrera sin confundirlos con semanas de carga', () => {
    assert.equal(determineMicrocycleLoadFocus('tapering'), 'recovery')
    assert.equal(determineMicrocycleLoadFocus('race'), 'race_specific')
  })
})
