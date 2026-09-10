import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildLoadProgressionPreview } from '@/lib/periodization/load-progression-preview'
import { generateFractalMacrocycle } from '@/lib/periodization/macrocycle-generator'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { assessPlanningRaceDistance, withPlanningRaceDistance } from '@/lib/periodization/race-distance-context'
import type { AthleteGroupCode } from '@/types/athlete/group.types'

describe('compatibilidad en el contexto de planificación', () => {
  it('genera S2 con 42K sin bloquear ni alterar estrategia u objetivo', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'race')
    const before = structuredClone(loadStrategy)
    const race = Object.freeze({ name: '42K', distanceKm: 42 })
    const planning = generateFractalMacrocycle({
      title: 'S2', startDate: '2026-01-05', endDate: '2026-03-29',
      athleteGroup: 'S2', goalType: 'race', loadStrategy, race,
    })
    assert.equal(planning.raceDistanceCompatibility?.status, 'incompatible')
    assert.equal(planning.raceDistanceCompatibility?.blocking, false)
    assert.equal(planning.race?.distanceKm, 42)
    assert.ok(planning.mesocycles.length > 0)
    assert.deepEqual(loadStrategy, before)
  })

  it('transporta los estados hasta la propuesta sin convertirlos en conflictos', () => {
    for (const [group, distance, expected] of [
      ['S2', 12, 'compatible'], ['S2', 42, 'incompatible'],
      ['E1', 42, 'unrestricted'], ['B3', 10, 'policy_not_defined'],
    ] as const) {
      const preview = buildLoadProgressionPreview({
        title: group, startDate: '2026-01-05', endDate: '2026-03-29',
        loadStrategy: suggestLoadStrategy(group, 'race'),
        targetRace: { name: 'Carrera', distanceKm: distance },
      })
      assert.equal(preview.planning.raceDistanceCompatibility?.status, expected)
      assert.deepEqual(preview.conflicts, [])
    }
  })

  it('no confunde volumen semanal con distancia cuando no hay carrera', () => {
    const preview = buildLoadProgressionPreview({
      title: 'Base', startDate: '2026-01-05', endDate: '2026-03-29',
      loadStrategy: suggestLoadStrategy('S2', 'base'),
    })
    assert.equal(preview.planning.raceDistanceCompatibility?.status, 'not_applicable')
  })

  it('evalúa snapshots persistidos sin mutarlos y usa la categoría del grupo', () => {
    const cycles = Object.freeze([
      Object.freeze({ id: 'base', targetRaceDistanceKm: 42 }),
      Object.freeze({ id: 'variant', targetRaceDistanceKm: 12 }),
      Object.freeze({ id: 'no-race', targetRaceDistanceKm: null }),
    ])
    const result = withPlanningRaceDistance('S', cycles)
    assert.deepEqual(result.map((cycle) => cycle.raceDistanceCompatibility.status),
      ['incompatible', 'compatible', 'not_applicable'])
    assert.equal(Object.hasOwn(cycles[0], 'raceDistanceCompatibility'), false)
    assert.equal(result[0].targetRaceDistanceKm, 42)
    assert.equal(withPlanningRaceDistance('M', cycles)[0].raceDistanceCompatibility.status, 'compatible')
  })

  it('ignora el nivel para compatibilidad y rechaza códigos de grupo malformados', () => {
    assert.deepEqual(assessPlanningRaceDistance('S1', { distanceKm: 42 }), assessPlanningRaceDistance('S3', { distanceKm: 42 }))
    assert.equal(assessPlanningRaceDistance('S9' as AthleteGroupCode, { distanceKm: 42 }).status, 'invalid')
  })
})
