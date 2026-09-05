import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
} from '@/db/schema'
import type { GeneratedMacrocycleDraft } from '@/types'

const PROTECTED_PERIODS = new Set(['competitive', 'transition'])

export interface PersistProgressionParams {
  groupTrainingPlanId: string
  macrocycleId: string
  planning: GeneratedMacrocycleDraft
  database?: typeof db
}

export interface PersistProgressionResult {
  createdMesocycles: number
  updatedMesocycles: number
  createdMicrocycles: number
  updatedMicrocycles: number
  deactivatedMicrocycles: number
}

export function persistProgression({
  groupTrainingPlanId,
  macrocycleId,
  planning,
  database = db,
}: PersistProgressionParams): PersistProgressionResult {
  const macrocycle = database.query.macrocycles.findFirst({
    where: and(eq(macrocycles.id, macrocycleId), eq(macrocycles.isDeleted, false)),
    with: {
      groupTrainingPlan: true,
      mesocycles: {
        with: { microcycles: true },
      },
    },
  }).sync()

  if (
    !macrocycle
    || macrocycle.groupTrainingPlanId !== groupTrainingPlanId
    || macrocycle.groupTrainingPlan.isDeleted
  ) {
    throw new Error('No se encontró el macrociclo del plan indicado.')
  }

  const activeMesocycles = macrocycle.mesocycles.filter((mesocycle) => !mesocycle.isDeleted)
  const protectedMesocycles = activeMesocycles.filter((mesocycle) => (
    PROTECTED_PERIODS.has(mesocycle.period)
  ))
  const trainingMesocycles = activeMesocycles.filter((mesocycle) => (
    !PROTECTED_PERIODS.has(mesocycle.period)
  ))
  const existingMesocyclesByNumber = new Map<number, (typeof trainingMesocycles)[number]>()
  const existingMicrocyclesByWeek = new Map<number, (typeof microcycles.$inferSelect)>()

  for (const protectedMesocycle of protectedMesocycles) {
    if (planning.mesocycles.some((candidate) => candidate.number === protectedMesocycle.number)) {
      throw new Error(`El mesociclo ${protectedMesocycle.number} está reservado para un bloque competitivo o de transición.`)
    }
  }

  for (const mesocycle of trainingMesocycles) {
    if (existingMesocyclesByNumber.has(mesocycle.number)) {
      throw new Error(`El mesociclo ${mesocycle.number} está duplicado.`)
    }

    existingMesocyclesByNumber.set(mesocycle.number, mesocycle)

    for (const microcycle of mesocycle.microcycles.filter((week) => !week.isDeleted)) {
      if (existingMicrocyclesByWeek.has(microcycle.weekNumber)) {
        throw new Error(`La semana ${microcycle.weekNumber} está duplicada.`)
      }

      existingMicrocyclesByWeek.set(microcycle.weekNumber, microcycle)
    }
  }

  const proposedWeekNumbers = new Set(
    planning.mesocycles.flatMap((mesocycle) => (
      mesocycle.microcycles.map((microcycle) => microcycle.weekNumber)
    )),
  )
  const result: PersistProgressionResult = {
    createdMesocycles: 0,
    updatedMesocycles: 0,
    createdMicrocycles: 0,
    updatedMicrocycles: 0,
    deactivatedMicrocycles: 0,
  }
  const now = new Date().toISOString()

  database.transaction((tx) => {
    for (const proposedMesocycle of planning.mesocycles) {
      const existingMesocycle = existingMesocyclesByNumber.get(proposedMesocycle.number)
      const mesocycleId = existingMesocycle?.id ?? randomUUID()

      if (existingMesocycle) {
        tx.update(mesocycles)
          .set({
            title: proposedMesocycle.title,
            period: proposedMesocycle.period,
            objective: proposedMesocycle.objective,
            updatedAt: now,
          })
          .where(eq(mesocycles.id, existingMesocycle.id))
          .run()
        result.updatedMesocycles += 1
      } else {
        tx.insert(mesocycles).values({
          id: mesocycleId,
          macrocycleId,
          title: proposedMesocycle.title,
          number: proposedMesocycle.number,
          period: proposedMesocycle.period,
          objective: proposedMesocycle.objective,
          createdAt: now,
          updatedAt: now,
        }).run()
        result.createdMesocycles += 1
      }

      for (const proposedMicrocycle of proposedMesocycle.microcycles) {
        const existingMicrocycle = existingMicrocyclesByWeek.get(proposedMicrocycle.weekNumber)

        if (existingMicrocycle) {
          tx.update(microcycles)
            .set({
              mesocycleId,
              targetVolumeKm: proposedMicrocycle.targetVolumeKm,
              targetVolumeSource: proposedMicrocycle.targetVolumeSource,
              targetElevationGain: proposedMicrocycle.targetElevationGain,
              targetElevationSource: proposedMicrocycle.targetElevationSource,
              isDeleted: false,
              updatedAt: now,
            })
            .where(eq(microcycles.id, existingMicrocycle.id))
            .run()
          result.updatedMicrocycles += 1
        } else {
          tx.insert(microcycles).values({
            id: randomUUID(),
            mesocycleId,
            weekNumber: proposedMicrocycle.weekNumber,
            type: proposedMicrocycle.type,
            startDate: proposedMicrocycle.startDate,
            endDate: proposedMicrocycle.endDate,
            targetVolumeKm: proposedMicrocycle.targetVolumeKm,
            targetVolumeSource: proposedMicrocycle.targetVolumeSource,
            targetElevationGain: proposedMicrocycle.targetElevationGain,
            targetElevationSource: proposedMicrocycle.targetElevationSource,
            targetDurationMin: null,
            notes: proposedMicrocycle.notes,
            createdAt: now,
            updatedAt: now,
          }).run()
          result.createdMicrocycles += 1
        }
      }
    }

    for (const existingMicrocycle of existingMicrocyclesByWeek.values()) {
      if (!proposedWeekNumbers.has(existingMicrocycle.weekNumber)) {
        tx.update(microcycles)
          .set({ isDeleted: true, updatedAt: now })
          .where(eq(microcycles.id, existingMicrocycle.id))
          .run()
        result.deactivatedMicrocycles += 1
      }
    }

    for (const existingMesocycle of trainingMesocycles) {
      if (!planning.mesocycles.some((candidate) => candidate.number === existingMesocycle.number)) {
        tx.update(mesocycles)
          .set({ isDeleted: true, updatedAt: now })
          .where(eq(mesocycles.id, existingMesocycle.id))
          .run()
      }
    }

    tx.update(groupTrainingPlans)
      .set({ updatedAt: now })
      .where(eq(groupTrainingPlans.id, groupTrainingPlanId))
      .run()
  })

  return result
}
