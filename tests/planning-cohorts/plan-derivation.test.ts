import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  derivePlanningCohortVariant,
  PlanningVariantDerivationError,
  type PlanningVariantSource,
} from '@/lib/planning-cohorts/plan-derivation'
import type {
  GroupTrainingPlan,
  IntensityStrategy,
  LoadStrategy,
  MicrocycleIntensityTarget,
  PlanningCohort,
} from '@/types'

const cohort: PlanningCohort = {
  id: 'cohort-42k',
  teamId: 'team-1',
  groupId: 'group-m1',
  name: 'M1 objetivo 42K',
  purpose: 'Compartir una variante temporal orientada a 42K.',
  description: null,
  status: 'active',
}

function createSource(): PlanningVariantSource {
  const plan: GroupTrainingPlan = {
    id: 'plan-base',
    groupId: 'group-m1',
    planningCohortId: null,
    sourceGroupTrainingPlanId: null,
    title: 'Plan base M1',
    status: 'active',
    notes: 'Plan base del grupo.',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    macrocycles: [
      {
        id: 'macro-base',
        groupTrainingPlanId: 'plan-base',
        title: 'Macrociclo principal',
        startDate: '2026-09-01',
        endDate: '2026-12-20',
        taperingWeeksCount: 2,
        targetRaceName: 'Trail 42K',
        targetRaceDistanceKm: 42,
        targetRaceElevationGain: 1800,
        notes: 'Preparación general.',
        createdAt: '2026-08-01T00:00:00.000Z',
        mesocycles: [
          {
            id: 'meso-base',
            macrocycleId: 'macro-base',
            title: 'Desarrollo',
            number: 1,
            period: 'specific_preparatory',
            objective: 'Desarrollar carga específica.',
            microcycles: [
              {
                id: 'micro-base',
                mesocycleId: 'meso-base',
                weekNumber: 1,
                type: 'development',
                loadFocus: 'elevation',
                startDate: '2026-09-07',
                endDate: '2026-09-13',
                targetVolumeKm: 52,
                targetVolumeSource: 'manual',
                targetElevationGain: 2100,
                targetElevationSource: 'generated',
                targetDurationMin: null,
                notes: 'Semana ajustada por el entrenador.',
                sessions: [
                  {
                    id: 'session-base',
                    teamId: 'team-1',
                    date: '2026-09-09',
                    title: 'Trail técnico',
                    type: 'Trail',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  const loadStrategy: LoadStrategy = {
    id: 'load-base',
    groupTrainingPlanId: plan.id,
    context: {
      athleteGroup: 'M1',
      goalType: 'race',
    },
    values: {
      initialWeeklyVolumeKm: 38,
      maximumWeeklyVolumeKm: 70,
      maximumWeeklyIncreasePercentage: 10,
      deloadPercentage: 25,
      initialWeeklyElevationGain: 900,
      maximumWeeklyElevationGain: 2800,
    },
    fieldSources: {
      initialWeeklyVolumeKm: 'suggested',
      maximumWeeklyVolumeKm: 'manual',
      maximumWeeklyIncreasePercentage: 'suggested',
      deloadPercentage: 'manual',
      initialWeeklyElevationGain: 'suggested',
      maximumWeeklyElevationGain: 'manual',
    },
    createdAt: '2026-08-01T00:00:00.000Z',
  }

  const intensityStrategy: IntensityStrategy = {
    id: 'intensity-base',
    groupTrainingPlanId: plan.id,
    context: {
      athleteGroup: 'M1',
      goalType: 'race',
    },
    values: {
      defaultMethod: 'hr_zone',
      maximumIntenseSessionsPerWeek: 2,
      minimumRecoveryDaysBetweenIntenseSessions: 2,
    },
    fieldSources: {
      defaultMethod: 'suggested',
      maximumIntenseSessionsPerWeek: 'manual',
      minimumRecoveryDaysBetweenIntenseSessions: 'manual',
    },
  }

  const intensityTarget: MicrocycleIntensityTarget = {
    id: 'target-base',
    microcycleId: 'micro-base',
    emphasis: 'threshold',
    intenseSessionsTarget: 2,
    predominantZone: 'Z2',
    pamPercentageTarget: 92.5,
    minimumRecoveryDaysBetweenIntenseSessions: 2,
    fieldSources: {
      intenseSessionsTarget: 'manual',
      predominantZone: 'generated',
      pamPercentageTarget: 'manual',
      minimumRecoveryDaysBetweenIntenseSessions: 'generated',
    },
  }

  return {
    plan,
    loadStrategy,
    intensityStrategy,
    sessionGenerationPreferences: {
      id: 'preferences-base',
      groupTrainingPlanId: plan.id,
      frequencyMode: 'fixed',
      fixedSessionsPerWeek: 5,
      weeklyPattern: [
        { weekday: 'monday', role: 'base' },
        { weekday: 'tuesday', role: 'quality' },
        { weekday: 'wednesday', role: 'long' },
        { weekday: 'thursday', role: 'recovery' },
        { weekday: 'saturday', role: 'mountain' },
      ],
    },
    microcycleIntensityTargets: [intensityTarget],
  }
}

function deterministicIds() {
  let index = 0

  return () => {
    index += 1
    return `derived-${index}`
  }
}

describe('derivación de variantes de planificación', () => {
  it('deriva un snapshot draft asociado directamente al plan base y a la cohorte', () => {
    const source = createSource()

    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Plan M1 — variante 42K',
      createId: deterministicIds(),
    })

    assert.equal(result.plan.id, 'derived-1')
    assert.equal(result.plan.groupId, source.plan.groupId)
    assert.equal(result.plan.planningCohortId, cohort.id)
    assert.equal(result.plan.sourceGroupTrainingPlanId, source.plan.id)
    assert.equal(result.plan.status, 'draft')
    assert.equal(result.plan.title, 'Plan M1 — variante 42K')
    assert.equal(result.plan.notes, source.plan.notes)

    assert.equal(result.identityMap.planId, result.plan.id)
  })

  it('copia estrategias y preferencias con nuevas identidades preservando valores y provenance', () => {
    const source = createSource()

    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante',
      createId: deterministicIds(),
    })

    assert.ok(result.loadStrategy)
    assert.ok(result.intensityStrategy)
    assert.ok(result.sessionGenerationPreferences)

    assert.notEqual(result.loadStrategy.id, source.loadStrategy?.id)
    assert.notEqual(result.intensityStrategy.id, source.intensityStrategy?.id)
    assert.notEqual(result.sessionGenerationPreferences.id, source.sessionGenerationPreferences?.id)

    assert.equal(result.loadStrategy.groupTrainingPlanId, result.plan.id)
    assert.equal(result.intensityStrategy.groupTrainingPlanId, result.plan.id)
    assert.equal(result.sessionGenerationPreferences.groupTrainingPlanId, result.plan.id)

    assert.deepEqual(result.loadStrategy.values, source.loadStrategy?.values)
    assert.deepEqual(result.loadStrategy.fieldSources, source.loadStrategy?.fieldSources)

    assert.deepEqual(result.intensityStrategy.values, source.intensityStrategy?.values)
    assert.deepEqual(result.intensityStrategy.fieldSources, source.intensityStrategy?.fieldSources)

    assert.deepEqual(
      result.sessionGenerationPreferences.weeklyPattern,
      source.sessionGenerationPreferences?.weeklyPattern,
    )

    assert.notStrictEqual(result.loadStrategy.values, source.loadStrategy?.values)
    assert.notStrictEqual(result.loadStrategy.fieldSources, source.loadStrategy?.fieldSources)
    assert.notStrictEqual(result.intensityStrategy.values, source.intensityStrategy?.values)
    assert.notStrictEqual(
      result.sessionGenerationPreferences.weeklyPattern,
      source.sessionGenerationPreferences?.weeklyPattern,
    )

    assert.notStrictEqual(
      result.sessionGenerationPreferences.weeklyPattern[0],
      source.sessionGenerationPreferences?.weeklyPattern[0],
    )
  })

  it('genera nuevas identidades y remapea correctamente toda la jerarquía de planificación', () => {
    const source = createSource()

    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante',
      createId: deterministicIds(),
    })

    const macrocycle = result.plan.macrocycles?.[0]
    const mesocycle = macrocycle?.mesocycles?.[0]
    const microcycle = mesocycle?.microcycles?.[0]
    const intensityTarget = result.microcycleIntensityTargets[0]

    assert.ok(macrocycle)
    assert.ok(mesocycle)
    assert.ok(microcycle)
    assert.ok(intensityTarget)

    assert.notEqual(macrocycle.id, 'macro-base')
    assert.notEqual(mesocycle.id, 'meso-base')
    assert.notEqual(microcycle.id, 'micro-base')
    assert.notEqual(intensityTarget.id, 'target-base')

    assert.equal(macrocycle.groupTrainingPlanId, result.plan.id)
    assert.equal(mesocycle.macrocycleId, macrocycle.id)
    assert.equal(microcycle.mesocycleId, mesocycle.id)
    assert.equal(intensityTarget.microcycleId, microcycle.id)

    assert.equal(result.identityMap.macrocycleIds['macro-base'], macrocycle.id)
    assert.equal(result.identityMap.mesocycleIds['meso-base'], mesocycle.id)
    assert.equal(result.identityMap.microcycleIds['micro-base'], microcycle.id)
    assert.equal(result.identityMap.intensityTargetIds['target-base'], intensityTarget.id)
  })

  it('preserva valores manuales/generados del microciclo y su objetivo de intensidad', () => {
    const source = createSource()

    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante',
      createId: deterministicIds(),
    })

    const sourceMicrocycle = source.plan.macrocycles?.[0]?.mesocycles?.[0]?.microcycles?.[0]
    const derivedMicrocycle = result.plan.macrocycles?.[0]?.mesocycles?.[0]?.microcycles?.[0]

    const sourceTarget = source.microcycleIntensityTargets[0]
    const derivedTarget = result.microcycleIntensityTargets[0]

    assert.ok(sourceMicrocycle)
    assert.ok(derivedMicrocycle)
    assert.ok(sourceTarget)
    assert.ok(derivedTarget)

    assert.equal(derivedMicrocycle.targetVolumeSource, sourceMicrocycle.targetVolumeSource)
    assert.equal(derivedMicrocycle.targetElevationSource, sourceMicrocycle.targetElevationSource)

    assert.deepEqual(derivedTarget.fieldSources, sourceTarget.fieldSources)
    assert.notStrictEqual(derivedTarget.fieldSources, sourceTarget.fieldSources)

    assert.equal(derivedTarget.pamPercentageTarget, sourceTarget.pamPercentageTarget)
  })

  it('no copia sesiones materializadas desde los microciclos del plan base', () => {
    const source = createSource()

    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante',
      createId: deterministicIds(),
    })

    const sourceMicrocycle = source.plan.macrocycles?.[0]?.mesocycles?.[0]?.microcycles?.[0]
    const derivedMicrocycle = result.plan.macrocycles?.[0]?.mesocycles?.[0]?.microcycles?.[0]

    assert.equal(sourceMicrocycle?.sessions?.length, 1)
    assert.equal(derivedMicrocycle?.sessions, undefined)
  })

  it('mantiene independencia mutable en ambas direcciones después de derivar', () => {
    const source = createSource()

    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante',
      createId: deterministicIds(),
    })

    const sourceMicrocycle = source.plan.macrocycles?.[0]?.mesocycles?.[0]?.microcycles?.[0]
    const derivedMicrocycle = result.plan.macrocycles?.[0]?.mesocycles?.[0]?.microcycles?.[0]

    assert.ok(source.loadStrategy)
    assert.ok(result.loadStrategy)
    assert.ok(sourceMicrocycle)
    assert.ok(derivedMicrocycle)

    result.loadStrategy.values.initialWeeklyVolumeKm = 99
    derivedMicrocycle.notes = 'Cambio exclusivo de la variante'

    assert.equal(source.loadStrategy.values.initialWeeklyVolumeKm, 38)
    assert.equal(sourceMicrocycle.notes, 'Semana ajustada por el entrenador.')

    source.loadStrategy.values.maximumWeeklyVolumeKm = 88
    sourceMicrocycle.targetVolumeKm = 61

    assert.equal(result.loadStrategy.values.maximumWeeklyVolumeKm, 70)
    assert.equal(derivedMicrocycle.targetVolumeKm, 52)
  })

  it('rechaza derivar una variante desde otra variante', () => {
    const source = createSource()

    source.plan.planningCohortId = 'another-cohort'
    source.plan.sourceGroupTrainingPlanId = 'original-base'

    assert.throws(
      () =>
        derivePlanningCohortVariant({
          source,
          cohort,
          title: 'Variante inválida',
          createId: deterministicIds(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlanningVariantDerivationError)
        assert.equal(error.issues[0]?.code, 'source-plan-not-base')
        return true
      },
    )
  })

  it('rechaza una cohorte archivada o perteneciente a otro grupo', () => {
    const archivedCohort: PlanningCohort = {
      ...cohort,
      status: 'archived',
    }

    const otherGroupCohort: PlanningCohort = {
      ...cohort,
      id: 'cohort-other-group',
      groupId: 'group-s2',
    }

    assert.throws(
      () =>
        derivePlanningCohortVariant({
          source: createSource(),
          cohort: archivedCohort,
          title: 'Variante',
          createId: deterministicIds(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlanningVariantDerivationError)
        assert.ok(error.issues.some((issue) => issue.code === 'cohort-archived'))
        return true
      },
    )

    assert.throws(
      () =>
        derivePlanningCohortVariant({
          source: createSource(),
          cohort: otherGroupCohort,
          title: 'Variante',
          createId: deterministicIds(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlanningVariantDerivationError)
        assert.ok(error.issues.some((issue) => issue.code === 'cohort-group-mismatch'))
        return true
      },
    )
  })

  it('rechaza objetivos de intensidad que no pertenecen a un microciclo del snapshot', () => {
    const source = createSource()

    source.microcycleIntensityTargets[0] = {
      ...source.microcycleIntensityTargets[0],
      microcycleId: 'microcycle-outside-plan',
    }

    assert.throws(
      () =>
        derivePlanningCohortVariant({
          source,
          cohort,
          title: 'Variante',
          createId: deterministicIds(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlanningVariantDerivationError)
        assert.equal(error.issues[0]?.code, 'intensity-target-outside-source-plan')
        return true
      },
    )
  })

  it('rechaza IDs derivados repetidos o reutilizados desde el plan base', () => {
    const duplicateId = () => 'derived-duplicate'

    assert.throws(
      () =>
        derivePlanningCohortVariant({
          source: createSource(),
          cohort,
          title: 'Variante',
          createId: duplicateId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlanningVariantDerivationError)
        assert.equal(error.issues[0]?.code, 'duplicate-derived-id')
        return true
      },
    )

    assert.throws(
      () =>
        derivePlanningCohortVariant({
          source: createSource(),
          cohort,
          title: 'Variante',
          createId: () => 'plan-base',
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlanningVariantDerivationError)
        assert.equal(error.issues[0]?.code, 'derived-id-reuses-source-id')
        return true
      },
    )
  })
})
