import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildLoadProgressionPreview,
  determineTrainingProgressionEndDate,
} from '@/lib/periodization/load-progression-preview'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

describe('vista previa de progresión', () => {
  it('calcula puntos semanales sin persistirlos', () => {
    const preview = buildLoadProgressionPreview({
      title: 'Vista previa S2',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      loadStrategy: suggestLoadStrategy('S2', 'base'),
    })
    const weeks = preview.planning.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)

    assert.equal(weeks.length, 8)
    assert.equal(weeks.every((week) => week.targetVolumeSource === 'generated'), true)
    assert.deepEqual(preview.conflicts, [])
  })

  it('refleja valores manuales y conflictos en la vista previa', () => {
    const preview = buildLoadProgressionPreview({
      title: 'Vista previa S2',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      loadStrategy: suggestLoadStrategy('S2', 'base'),
      existingMicrocycles: [
        { id: 'week-2', weekNumber: 2, targetVolumeKm: 45, targetVolumeSource: 'manual' },
      ],
    })
    const week = preview.planning.mesocycles[0].microcycles[1]

    assert.equal(week.targetVolumeKm, 45)
    assert.equal(week.targetVolumeSource, 'manual')
    assert.equal(preview.conflicts[0].code, 'manual_volume_above_maximum')
  })

  it('termina la progresión antes de un bloque competitivo existente', () => {
    const protectedStarts = ['2026-03-16', '2026-03-09']

    assert.equal(
      determineTrainingProgressionEndDate('2026-03-22', protectedStarts),
      '2026-03-08',
    )
    assert.deepEqual(protectedStarts, ['2026-03-16', '2026-03-09'])
    assert.equal(
      determineTrainingProgressionEndDate('2026-03-22', []),
      '2026-03-22',
    )
  })

  it('transporta la carrera objetivo sin convertirla todavía en carga semanal', () => {
    const preview = buildLoadProgressionPreview({
      title: 'Preparación Patagonia Run',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      loadStrategy: suggestLoadStrategy('S2', 'race'),
      targetRace: {
        name: 'Patagonia Run',
        distanceKm: 42.2,
        elevationGain: 2400,
      },
    })

    assert.deepEqual(preview.planning.race, {
      name: 'Patagonia Run',
      distanceKm: 42.2,
      elevationGain: 2400,
    })
  })
})
