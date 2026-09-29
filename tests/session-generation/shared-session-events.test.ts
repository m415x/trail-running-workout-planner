import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import type {
  SessionGenerationProposal,
  SessionGenerationResult,
} from '@/types/training/session-generation.types'

describe('reutilización de eventos entre grupos', () => {
  it('crea un solo evento con prescripciones independientes para grupos compatibles', () => {
    const s2 = proposal('S2', 'micro-s2', 12, 500, 'Z2')
    const m1 = proposal('M1', 'micro-m1', 16, 800, 'Z3')
    const result = groupSharedSessionEvents([generation(s2), generation(m1)])

    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].prescriptions.length, 2)
    assert.deepEqual(
      result.events[0].prescriptions.map(({ prescription }) => ({
        groupId: prescription.groupId,
        microcycleId: prescription.microcycleId,
        distanceKm: prescription.distanceKm,
        elevationGain: prescription.elevationGain,
        zone: prescription.zone,
      })),
      [
        { groupId: 'M1', microcycleId: 'micro-m1', distanceKm: 16, elevationGain: 800, zone: 'Z3' },
        { groupId: 'S2', microcycleId: 'micro-s2', distanceKm: 12, elevationGain: 500, zone: 'Z2' },
      ],
    )
  })

  it('consolida Base y Variant del mismo grupo junto con otro grupo en una sola Session', () => {
    const baseS2 = proposal('S2', 'micro-base-s2', 12, 500, 'Z2')
    const variantS2 = proposal('S2', 'micro-variant-s2', 9, 350, 'Z3')
    variantS2.generationKey = 'plan-variant-s2::micro-variant-s2::S2::weekly-saturday'
    const m1 = proposal('M1', 'micro-m1', 16, 800, 'Z3')

    const result = groupSharedSessionEvents([
      generation(baseS2),
      generation(variantS2),
      generation(m1),
    ])

    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].prescriptions.length, 3)
    assert.deepEqual(
      result.events[0].prescriptions.map(({ prescription }) => ({
        groupId: prescription.groupId,
        microcycleId: prescription.microcycleId,
      })),
      [
        { groupId: 'M1', microcycleId: 'micro-m1' },
        { groupId: 'S2', microcycleId: 'micro-base-s2' },
        { groupId: 'S2', microcycleId: 'micro-variant-s2' },
      ],
    )
  })

  it('mantiene eventos separados cuando cambia la identidad compartida', () => {
    const first = proposal('S2', 'micro-s2', 12, 500, 'Z2')
    const second = {
      ...proposal('M1', 'micro-m1', 16, 800, 'Z3'),
      sharedEventKey: 'team-1::2026-09-13::long::template-long',
      session: {
        ...first.session,
        date: '2026-09-13',
        title: 'Fondo dominical',
      },
    }
    const result = groupSharedSessionEvents([generation(first, second)])

    assert.equal(result.events.length, 2)
    assert.deepEqual(result.events.map(({ session }) => session.date), [
      '2026-09-12',
      '2026-09-13',
    ])
  })

  it('consolida advertencias globales y por evento sin duplicarlas', () => {
    const first = { ...proposal('S2', 'micro-s2', 12, 500, 'Z2'), warnings: ['Revisar ruta'] }
    const second = { ...proposal('M1', 'micro-m1', 16, 800, 'Z3'), warnings: ['Revisar ruta'] }
    const result = groupSharedSessionEvents([
      { proposals: [first], warnings: ['Revisar ruta', 'Advertencia grupal'] },
      { proposals: [second], warnings: ['Revisar ruta'] },
    ])

    assert.deepEqual(result.events[0].warnings, ['Revisar ruta'])
    assert.deepEqual(result.warnings, ['Revisar ruta', 'Advertencia grupal'])
  })

  it('rechaza colisiones que intentarían mezclar eventos diferentes', () => {
    const first = proposal('S2', 'micro-s2', 12, 500, 'Z2')
    const incompatible = {
      ...proposal('M1', 'micro-m1', 16, 800, 'Z3'),
      session: { ...first.session, title: 'Otro entrenamiento' },
    }

    assert.throws(
      () => groupSharedSessionEvents([generation(first, incompatible)]),
      /incompatible session values/,
    )
  })

  it('permite prescripciones del mismo grupo cuando pertenecen a planning scopes distintos', () => {
    const base = proposal('S2', 'micro-base-s2', 12, 500, 'Z2')
    const variant = proposal('S2', 'micro-variant-s2', 9, 350, 'Z3')
    variant.generationKey = 'plan-variant-s2::micro-variant-s2::S2::weekly-saturday'

    const result = groupSharedSessionEvents([generation(base), generation(variant)])

    assert.equal(result.events.length, 1)
    assert.deepEqual(
      result.events[0].prescriptions.map(({ prescription }) => ({
        groupId: prescription.groupId,
        microcycleId: prescription.microcycleId,
        distanceKm: prescription.distanceKm,
        elevationGain: prescription.elevationGain,
        zone: prescription.zone,
      })),
      [
        { groupId: 'S2', microcycleId: 'micro-base-s2', distanceKm: 12, elevationGain: 500, zone: 'Z2' },
        { groupId: 'S2', microcycleId: 'micro-variant-s2', distanceKm: 9, elevationGain: 350, zone: 'Z3' },
      ],
    )
  })

  it('rechaza planning scopes repetidos y claves de generación duplicadas', () => {
    const first = proposal('S2', 'micro-s2', 12, 500, 'Z2')
    const sameGroup = { ...first, generationKey: 'plan-2::micro-2::S2::weekly-saturday' }
    const duplicatedKey = proposal('M1', 'micro-m1', 16, 800, 'Z3')
    duplicatedKey.generationKey = first.generationKey

    assert.throws(
      () => groupSharedSessionEvents([generation(first, sameGroup)]),
      /duplicate planning scope micro-s2/,
    )
    assert.throws(
      () => groupSharedSessionEvents([generation(first, duplicatedKey)]),
      /Duplicated generation key/,
    )
  })

  it('copia los valores anidados para no mutar la propuesta original', () => {
    const original = proposal('S2', 'micro-s2', 12, 500, 'Z2')
    const result = groupSharedSessionEvents([generation(original)])

    result.events[0].session.structure!.mainBlock = 'Modificado'
    result.events[0].prescriptions[0].prescription.distanceKm = 99

    assert.equal(original.session.structure?.mainBlock, '3 x 10 minutos')
    assert.equal(original.prescription.distanceKm, 12)
  })
})

function generation(...proposals: SessionGenerationProposal[]): SessionGenerationResult {
  return { proposals, warnings: [] }
}

function proposal(
  groupId: string,
  microcycleId: string,
  distanceKm: number,
  elevationGain: number,
  zone: 'Z2' | 'Z3',
): SessionGenerationProposal {
  return {
    generationKey: `plan-${groupId}::${microcycleId}::${groupId}::weekly-saturday`,
    sharedEventKey: 'team-1::2026-09-12::long::template-long',
    slotKey: 'weekly-saturday',
    role: 'long',
    session: {
      date: '2026-09-12',
      title: 'Fondo compartido',
      type: 'Long',
      sourceTemplateId: 'template-long',
      locationKey: 'park',
      trackPath: null,
      structure: { mainBlock: '3 x 10 minutos' },
      notes: null,
    },
    prescription: {
      groupId,
      microcycleId,
      distanceKm,
      durationMin: null,
      elevationGain,
      intensityMethod: 'hr_zone',
      zone,
      referencePercentage: null,
      notes: null,
    },
    warnings: [],
  }
}
