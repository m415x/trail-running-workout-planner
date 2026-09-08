import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'
import { generateWeeklySessionProposals } from '@/lib/session-generation/session-proposal-generator'
import { reconcileSessionGeneration } from '@/lib/session-generation/session-regeneration'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import type { SessionGenerationContext } from '@/types/training/session-generation.types'
import type { WorkoutTemplate } from '@/types/training/workout-template.types'

const templates: WorkoutTemplate[] = [
  template('mountain', 'Montaña', 'mountain', 'Trail'),
  template('quality', 'Calidad', 'quality', 'PAM'),
  template('long', 'Fondo', 'endurance', 'Long'),
  template('race', 'Competencia', 'competition', 'Race'),
  template('base', 'Rodaje', 'endurance', 'Base'),
]

describe('flujo integral de generación semanal', () => {
  it('genera dos grupos, comparte eventos y regenera sin duplicarlos', () => {
    const s2 = generateWeeklySessionProposals({ context: context('S2', 'micro-s2', 40), templates })
    const m1 = generateWeeklySessionProposals({ context: context('M1', 'micro-m1', 55), templates })
    const shared = groupSharedSessionEvents([s2, m1])
    const first = reconcileSessionGeneration({
      proposal: shared, existingEvents: [], existingPrescriptions: [],
    })

    assert.equal(shared.events.length, 3)
    assert.ok(shared.events.every(({ prescriptions }) => prescriptions.length === 2))
    assert.equal(first.events.filter(({ action }) => action === 'create').length, 3)
    assert.equal(first.prescriptions.filter(({ action }) => action === 'create').length, 6)

    const existingEvents = shared.events.map((event, index) => ({
      id: `session-${index}`,
      provenance: { ownership: 'generated' as const, sharedEventKey: event.sharedEventKey },
    }))
    const sessionByKey = new Map(existingEvents.map((item) => [item.provenance.sharedEventKey, item.id]))
    const existingPrescriptions = shared.events.flatMap((event) => event.prescriptions.map((item, index) => ({
      id: `${sessionByKey.get(event.sharedEventKey)}-prescription-${index}`,
      sessionId: sessionByKey.get(event.sharedEventKey)!,
      provenance: { ownership: 'generated' as const, generationKey: item.generationKey },
    })))
    const repeated = reconcileSessionGeneration({ proposal: shared, existingEvents, existingPrescriptions })

    assert.equal(repeated.events.filter(({ action }) => action === 'replace').length, 3)
    assert.equal(repeated.prescriptions.filter(({ action }) => action === 'replace').length, 6)
    assert.deepEqual(repeated.obsoleteEventIds, [])
    assert.deepEqual(repeated.obsoletePrescriptionIds, [])
  })

  it('preserva una prescripción editada mientras regenera las demás', () => {
    const generated = generateWeeklySessionProposals({ context: context('S2', 'micro-s2', 40), templates })
    const shared = groupSharedSessionEvents([generated])
    const existingEvents = shared.events.map((event, index) => ({
      id: `session-${index}`,
      provenance: { ownership: 'generated' as const, sharedEventKey: event.sharedEventKey },
    }))
    const editedKey = shared.events[0].prescriptions[0].generationKey
    const existingPrescriptions = shared.events.flatMap((event, eventIndex) => (
      event.prescriptions.map((item, index) => ({
        id: `prescription-${eventIndex}-${index}`,
        sessionId: `session-${eventIndex}`,
        provenance: {
          ownership: item.generationKey === editedKey ? 'generated_modified' as const : 'generated' as const,
          generationKey: item.generationKey,
        },
      }))
    ))
    const regenerated = reconcileSessionGeneration({ proposal: shared, existingEvents, existingPrescriptions })

    assert.equal(regenerated.events.length, 3)
    assert.equal(regenerated.prescriptions.length, 2)
    assert.equal(regenerated.protectedCollisions.length, 1)
    assert.equal(regenerated.preservedRecords[0]?.generationKey, editedKey)
    assert.equal(regenerated.preservedRecords[0]?.reason, 'modified')
  })

  it('mantiene la carrera separada del presupuesto de entrenamiento del taper', () => {
    const raceContext: SessionGenerationContext = {
      ...context('M1', 'micro-race', 23),
      period: 'competitive', microcycleType: 'race', endDate: '2026-09-13',
      competition: { name: 'Trail objetivo', date: '2026-09-13', distanceKm: 42, elevationGain: 1500 },
      frequency: { mode: 'auto' },
    }
    const generated = generateWeeklySessionProposals({ context: raceContext, templates })
    const race = generated.proposals.find(({ role }) => role === 'competition')
    const training = generated.proposals.filter(({ role }) => role !== 'competition')

    assert.equal(generated.proposals.length, 3)
    assert.equal(sumDistance(training), 23)
    assert.equal(race?.prescription.distanceKm, 42)
    assert.equal(race?.prescription.elevationGain, 1500)
    assert.equal(race?.session.date, '2026-09-13')
  })
})

function context(groupId: string, microcycleId: string, volume: number): SessionGenerationContext {
  return {
    teamId: 'team-1', groupTrainingPlanId: `plan-${groupId}`, groupId, microcycleId,
    period: 'specific_preparatory', microcycleType: 'development',
    startDate: '2026-09-07', endDate: '2026-09-13',
    load: { targetVolumeKm: volume, targetElevationGain: 1200, maximumWeeklyVolumeKm: 70 },
    intensity: {
      defaultMethod: 'pam_percentage', emphasis: 'vo2max', intenseSessionsTarget: 1,
      predominantZone: 'Z2', pamPercentageTarget: 95,
      minimumRecoveryDaysBetweenIntenseSessions: 2,
    },
    competition: null, frequency: { mode: 'fixed', sessionsPerWeek: 3 },
    pattern: DEFAULT_WEEKLY_TRAINING_PATTERN,
  }
}

function template(
  id: string,
  title: string,
  category: WorkoutTemplate['category'],
  type: WorkoutTemplate['sessionDefaults']['type'],
): WorkoutTemplate {
  return {
    id, teamId: 'team-1', category, tags: [], archivedAt: null,
    createdAt: '2026-09-01', updatedAt: '2026-09-01', isDeleted: false,
    sessionDefaults: {
      title, type, locationKey: null, trackPath: null,
      structure: { mainBlock: title }, notes: null,
    },
    prescriptionDefaults: {
      distanceKm: null, durationMin: null, elevationGain: null, intensity: null, notes: null,
    },
  }
}

function sumDistance(
  proposals: ReturnType<typeof generateWeeklySessionProposals>['proposals'],
) {
  return proposals.reduce((total, item) => total + (item.prescription.distanceKm ?? 0), 0)
}
