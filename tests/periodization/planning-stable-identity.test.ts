import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  stableMacrocycleIdentity,
  stableMesocycleIdentity,
  stableMicrocycleIdentity,
  stablePrescriptionIdentity,
  stableSessionIdentity,
} from '@/lib/periodization/planning-stable-identity'

describe('identidades estables de regeneración integral', () => {
  it('produce las mismas claves para una regeneración equivalente', () => {
    const macro = stableMacrocycleIdentity('plan-1', 1)
    const meso = stableMesocycleIdentity(macro, 2)

    assert.equal(macro, stableMacrocycleIdentity('plan-1', 1))
    assert.equal(meso, stableMesocycleIdentity(macro, 2))
    assert.equal(
      stableMicrocycleIdentity('plan-1', 7),
      stableMicrocycleIdentity('plan-1', 7),
    )
  })

  it('aísla las identidades de una variante respecto de su plan base', () => {
    assert.notEqual(
      stableMacrocycleIdentity('plan-base', 1),
      stableMacrocycleIdentity('plan-variant', 1),
    )
    assert.notEqual(
      stableMicrocycleIdentity('plan-base', 4),
      stableMicrocycleIdentity('plan-variant', 4),
    )
  })

  it('reutiliza las claves autoritativas H6 para sesiones y prescripciones', () => {
    assert.equal(
      stableSessionIdentity('random-id', {
        sharedEventKey: 'plan-1::micro-1::shared-tuesday',
      }),
      'session:generation:plan-1::micro-1::shared-tuesday',
    )
    assert.equal(
      stablePrescriptionIdentity('random-id', {
        generationKey: 'plan-1::micro-1::group-1::tuesday',
      }),
      'prescription:generation:plan-1::micro-1::group-1::tuesday',
    )
    assert.equal(
      stableSessionIdentity('manual-session', {
        sharedEventKey: null,
      }),
      'session:id:manual-session',
    )
  })

  it('rechaza componentes vacíos o posiciones inválidas', () => {
    assert.throws(() => stableMacrocycleIdentity('', 1), /cannot be empty/)
    assert.throws(() => stableMacrocycleIdentity('plan-1', 0), /positive integer/)
    assert.throws(
      () => stableMicrocycleIdentity('plan-1', Number.NaN),
      /positive integer/,
    )
    assert.throws(
      () => stableSessionIdentity('session-1', {
        sharedEventKey: ' ',
      }),
      /cannot be empty/,
    )
  })
})
