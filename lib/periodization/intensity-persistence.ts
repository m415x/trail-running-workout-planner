import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { intensityStrategies, microcycleIntensityTargets } from '@/db/intensity-strategy-schema'
import { loadStrategies } from '@/db/load-strategy-schema'
import { athleteGroups, groupTrainingPlans, macrocycles, mesocycles, microcycles } from '@/db/schema'
import { assertPersistableIntensityPlanning } from '@/lib/periodization/intensity-persistence-validator'
import { reconcileMicrocycleIntensityTarget } from '@/lib/periodization/intensity-target-regeneration'

import type { IntensityStrategyDraft, MicrocycleIntensityTargetDraft } from '@/types'

export interface PersistIntensityPlanningParams {
  groupTrainingPlanId: string
  strategy: IntensityStrategyDraft
  targets: Array<{ microcycleId: string; target: MicrocycleIntensityTargetDraft }>
  database?: typeof db
}

/** Persists one strategy and its weekly targets atomically after ownership checks. */
export function persistIntensityPlanning({
  groupTrainingPlanId,
  strategy,
  targets,
  database = db,
}: PersistIntensityPlanningParams): void {
  const plan = database.select({
    id: groupTrainingPlans.id,
    categoryCode: athleteGroups.categoryCode,
    levelCode: athleteGroups.levelCode,
    goalType: loadStrategies.goalType,
    sessionsPerWeek: loadStrategies.sessionsPerWeek,
  })
    .from(groupTrainingPlans)
    .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
    .innerJoin(loadStrategies, eq(loadStrategies.groupTrainingPlanId, groupTrainingPlans.id))
    .where(and(eq(groupTrainingPlans.id, groupTrainingPlanId), eq(groupTrainingPlans.isDeleted, false)))
    .get()

  if (!plan) throw new Error('No se encontró el plan grupal con su estrategia de carga.')
  if (`${plan.categoryCode}${plan.levelCode}` !== strategy.context.athleteGroup) {
    throw new Error('La estrategia de intensidad pertenece a otro grupo.')
  }
  if (plan.goalType !== strategy.context.goalType) {
    throw new Error('La estrategia de intensidad pertenece a otro objetivo.')
  }

  const ids = targets.map(({ microcycleId }) => microcycleId)
  if (new Set(ids).size !== ids.length) throw new Error('Hay objetivos de intensidad duplicados.')

  const ownedRows = ids.length === 0 ? [] : database.select({ id: microcycles.id })
    .from(microcycles)
    .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
    .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
    .where(and(inArray(microcycles.id, ids), eq(macrocycles.groupTrainingPlanId, groupTrainingPlanId)))
    .all()
  if (ownedRows.length !== ids.length) throw new Error('Uno o más microciclos no pertenecen al plan indicado.')

  const existingTargets = ids.length === 0 ? [] : database.select()
    .from(microcycleIntensityTargets)
    .where(inArray(microcycleIntensityTargets.microcycleId, ids))
    .all()
  const existingByMicrocycle = new Map(existingTargets.map((row) => [row.microcycleId, row]))
  const effectiveTargets = targets.map(({ microcycleId, target }) => {
    const existing = existingByMicrocycle.get(microcycleId)
    if (!existing || existing.isDeleted) return { microcycleId, target }

    return {
      microcycleId,
      target: reconcileMicrocycleIntensityTarget({
        generatedTarget: target,
        existingTarget: {
          emphasis: existing.emphasis,
          intenseSessionsTarget: existing.intenseSessionsTarget,
          predominantZone: existing.predominantZone,
          pamPercentageTarget: existing.pamPercentageTarget,
          minimumRecoveryDaysBetweenIntenseSessions: existing.minimumRecoveryDaysBetweenIntenseSessions,
          fieldSources: existing.fieldSources,
        },
      }).target,
    }
  })

  assertPersistableIntensityPlanning(
    strategy,
    effectiveTargets.map(({ target }) => target),
    plan.sessionsPerWeek,
  )

  const now = new Date().toISOString()
  const existingStrategy = database.select().from(intensityStrategies)
    .where(eq(intensityStrategies.groupTrainingPlanId, groupTrainingPlanId)).get()

  database.transaction((tx) => {
    const strategyValues = {
      goalType: strategy.context.goalType,
      defaultMethod: strategy.values.defaultMethod,
      maximumIntenseSessionsPerWeek: strategy.values.maximumIntenseSessionsPerWeek,
      minimumRecoveryDaysBetweenIntenseSessions: strategy.values.minimumRecoveryDaysBetweenIntenseSessions,
      fieldSources: strategy.fieldSources,
      isDeleted: false,
      updatedAt: now,
    }
    if (existingStrategy) {
      tx.update(intensityStrategies).set(strategyValues).where(eq(intensityStrategies.id, existingStrategy.id)).run()
    } else {
      tx.insert(intensityStrategies).values({ id: randomUUID(), groupTrainingPlanId, ...strategyValues, createdAt: now }).run()
    }

    for (const { microcycleId, target } of effectiveTargets) {
      const existing = existingByMicrocycle.get(microcycleId)
      const values = { ...target, isDeleted: false, updatedAt: now }
      if (existing) {
        tx.update(microcycleIntensityTargets).set(values).where(eq(microcycleIntensityTargets.id, existing.id)).run()
      } else {
        tx.insert(microcycleIntensityTargets).values({ id: randomUUID(), microcycleId, ...values, createdAt: now }).run()
      }
    }
  })
}
