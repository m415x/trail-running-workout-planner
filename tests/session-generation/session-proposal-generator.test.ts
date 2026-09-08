import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'
import { generateWeeklySessionProposals } from '@/lib/session-generation/session-proposal-generator'
import type { SessionGenerationContext } from '@/types/training/session-generation.types'
import type {
  WorkoutTemplate,
  WorkoutTemplateCategory,
} from '@/types/training/workout-template.types'
import type { WorkoutType } from '@/types/training/workout.types'

const context: SessionGenerationContext = {
  teamId: 'team-1',
  groupTrainingPlanId: 'plan-s2',
  groupId: 'group-s2',
  microcycleId: 'micro-8',
  period: 'specific_preparatory',
  microcycleType: 'development',
  startDate: '2026-09-07',
  endDate: '2026-09-13',
  load: {
    targetVolumeKm: 40,
    targetElevationGain: 1200,
    maximumWeeklyVolumeKm: 60,
  },
  intensity: {
    defaultMethod: 'pam_percentage',
    emphasis: 'vo2max',
    intenseSessionsTarget: 1,
    predominantZone: 'Z2',
    pamPercentageTarget: 95,
    minimumRecoveryDaysBetweenIntenseSessions: 2,
  },
  competition: null,
  frequency: { mode: 'fixed', sessionsPerWeek: 3 },
  pattern: DEFAULT_WEEKLY_TRAINING_PATTERN,
}

describe('construcción de propuestas semanales', () => {
  it('integra plantilla, fecha, cargas e intensidad sin persistir', () => {
    const result = generateWeeklySessionProposals({
      context,
      templates: [
        template('mountain', 'Cuestas del parque', 'mountain', 'Trail'),
        template('quality', 'Intervalos PAM', 'quality', 'PAM'),
        template('long', 'Fondo progresivo', 'endurance', 'Long'),
      ],
    })

    assert.equal(result.proposals.length, 3)
    assert.deepEqual(result.proposals.map(({ slotKey, session }) => [slotKey, session.date]), [
      ['weekly-tuesday', '2026-09-08'],
      ['weekly-thursday', '2026-09-10'],
      ['weekly-saturday', '2026-09-12'],
    ])
    assert.equal(sum(result.proposals, 'distanceKm'), 40)
    assert.equal(sum(result.proposals, 'elevationGain'), 1200)
    assert.ok(result.proposals.every(({ prescription }) => (
      prescription.groupId === 'group-s2' && prescription.microcycleId === 'micro-8'
    )))
    const intense = result.proposals.find(({ prescription }) => (
      prescription.intensityMethod === 'pam_percentage'
    ))
    assert.equal(intense?.slotKey, 'weekly-thursday')
    assert.equal(intense?.prescription.pamPercentage, 95)
    assert.deepEqual(result.warnings, [])
  })

  it('consume primero una ruta geográfica fija pero ignora su intensidad', () => {
    const route = template('route', 'Circuito fijo', 'mountain', 'Trail', {
      trackPath: '/routes/circuit.gpx',
      distanceKm: 16,
      elevationGain: 900,
    })
    route.prescriptionDefaults.intensity = { method: 'hr_zone', zone: 'Z5' }
    const long = template('long', 'Fondo', 'endurance', 'Long')
    long.tags = ['long', 'specific_preparatory']
    const result = generateWeeklySessionProposals({
      context,
      templates: [route, template('quality', 'Calidad', 'quality', 'PAM'), long],
    })
    const mountain = result.proposals.find(({ slotKey }) => slotKey === 'weekly-tuesday')

    assert.equal(mountain?.prescription.distanceKm, 16)
    assert.equal(mountain?.prescription.elevationGain, 900)
    assert.equal(mountain?.prescription.intensityMethod, 'hr_zone')
    assert.equal(mountain?.prescription.zone, 'Z2')
    assert.equal(sum(result.proposals, 'distanceKm'), 40)
    assert.equal(sum(result.proposals, 'elevationGain'), 1200)
  })

  it('genera un fallback explícito y advertencias cuando faltan plantillas', () => {
    const result = generateWeeklySessionProposals({ context, templates: [] })

    assert.equal(result.proposals.length, 3)
    assert.ok(result.proposals.every(({ session }) => session.sourceTemplateId === null))
    assert.ok(result.proposals.every(({ warnings }) => warnings.length === 1))
    assert.equal(result.warnings.length, 3)
  })

  it('produce claves estables y separa identidad grupal de evento compartido', () => {
    const templates = [
      template('mountain', 'Montaña', 'mountain', 'Trail'),
      template('quality', 'Calidad', 'quality', 'PAM'),
      template('long', 'Fondo', 'endurance', 'Long'),
    ]
    const first = generateWeeklySessionProposals({ context, templates })
    const second = generateWeeklySessionProposals({ context, templates })
    const otherGroup = generateWeeklySessionProposals({
      context: { ...context, groupId: 'group-m1', groupTrainingPlanId: 'plan-m1' },
      templates,
    })

    assert.deepEqual(first, second)
    assert.notEqual(first.proposals[0].generationKey, otherGroup.proposals[0].generationKey)
    assert.equal(first.proposals[0].sharedEventKey, otherGroup.proposals[0].sharedEventKey)
  })

  it('incluye la carrera dentro del total de sesiones y la asigna al microciclo', () => {
    const raceContext: SessionGenerationContext = {
      ...context,
      period: 'competitive',
      microcycleType: 'race',
      endDate: '2026-09-12',
      frequency: { mode: 'auto' },
      intensity: { ...context.intensity, intenseSessionsTarget: 1 },
      competition: {
        name: 'Carrera objetivo',
        date: '2026-09-12',
        distanceKm: 21,
        elevationGain: 900,
      },
    }
    const result = generateWeeklySessionProposals({
      context: raceContext,
      templates: [
        template('race', 'Carrera objetivo', 'competition', 'Race'),
        template('base', 'Rodaje', 'endurance', 'Base'),
        template('quality', 'Activación', 'quality', 'PAM'),
      ],
    })

    assert.equal(result.proposals.length, 3)
    const race = result.proposals.find(({ role }) => role === 'competition')
    assert.equal(race?.session.date, '2026-09-12')
    assert.equal(race?.prescription.microcycleId, 'micro-8')
    assert.equal(race?.prescription.distanceKm, 21)
    assert.equal(race?.prescription.elevationGain, 900)
    const training = result.proposals.filter(({ role }) => role !== 'competition')
    assert.equal(sum(training, 'distanceKm'), raceContext.load.targetVolumeKm)
    assert.equal(sum(training, 'elevationGain'), raceContext.load.targetElevationGain)
  })
})

function template(
  id: string,
  title: string,
  category: WorkoutTemplateCategory,
  type: WorkoutType,
  load: { trackPath?: string; distanceKm?: number; elevationGain?: number } = {},
): WorkoutTemplate {
  return {
    id,
    teamId: 'team-1',
    category,
    tags: [],
    archivedAt: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    isDeleted: false,
    sessionDefaults: {
      title,
      type,
      locationKey: null,
      trackPath: load.trackPath ?? null,
      structure: { mainBlock: title },
      notes: null,
    },
    prescriptionDefaults: {
      distanceKm: load.distanceKm ?? null,
      durationMin: null,
      elevationGain: load.elevationGain ?? null,
      intensity: null,
      notes: null,
    },
  }
}

function sum(
  proposals: ReturnType<typeof generateWeeklySessionProposals>['proposals'],
  field: 'distanceKm' | 'elevationGain',
) {
  return proposals.reduce((total, proposal) => total + (proposal.prescription[field] ?? 0), 0)
}
