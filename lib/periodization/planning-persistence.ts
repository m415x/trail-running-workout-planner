import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  athleteGroups,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
} from '@/db/schema'

import type { GeneratedMacrocycleDraft } from '@/types'

const CURRENT_TEAM_ID = 'team_1'

export interface PersistGeneratedPlanningParams {
  groupId: string
  planning: GeneratedMacrocycleDraft
  notes?: string
}

export interface PersistedPlanningResult {
  groupTrainingPlanId: string
  macrocycleId: string
  mesocycleIds: string[]
  microcycleIds: string[]
}

function raceSummary(planning: GeneratedMacrocycleDraft) {
  if (!planning.race) return null

  const elevation = planning.race.elevationGain === undefined
    ? ''
    : ` | +${planning.race.elevationGain}m D+`

  return `Carrera objetivo: ${planning.race.name} | ${planning.race.distanceKm} km${elevation}`
}

export function persistGeneratedPlanning({
  groupId,
  planning,
  notes,
}: PersistGeneratedPlanningParams): PersistedPlanningResult {
  return db.transaction((tx) => {
    const group = tx.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, groupId),
        eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(athleteGroups.isActive, true),
        eq(athleteGroups.isDeleted, false),
      ),
    }).sync()

    if (!group) {
      throw new Error('Grupo no encontrado o inactivo.')
    }

    const groupCode = `${group.categoryCode}${group.levelCode}`
    if (groupCode !== planning.athleteGroup) {
      throw new Error('El borrador de planificación pertenece a otro grupo.')
    }

    if (planning.mesocycles.length === 0) {
      throw new Error('La planificación debe contener al menos un mesociclo.')
    }

    const now = new Date().toISOString()
    const groupTrainingPlanId = randomUUID()
    const macrocycleId = randomUUID()
    const mesocycleIds: string[] = []
    const microcycleIds: string[] = []

    tx.insert(groupTrainingPlans).values({
      id: groupTrainingPlanId,
      groupId: group.id,
      title: planning.title,
      status: 'draft',
      notes: notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }).run()

    tx.insert(macrocycles).values({
      id: macrocycleId,
      groupTrainingPlanId,
      title: planning.title,
      startDate: planning.startDate,
      endDate: planning.endDate,
      taperingWeeksCount: planning.taperingWeeksCount,
      notes: raceSummary(planning),
      createdAt: now,
      updatedAt: now,
    }).run()

    planning.mesocycles.forEach((mesocycle) => {
      const mesocycleId = randomUUID()
      mesocycleIds.push(mesocycleId)

      tx.insert(mesocycles).values({
        id: mesocycleId,
        macrocycleId,
        title: mesocycle.title,
        number: mesocycle.number,
        period: mesocycle.period,
        objective: mesocycle.objective,
        createdAt: now,
        updatedAt: now,
      }).run()

      mesocycle.microcycles.forEach((microcycle) => {
        const microcycleId = randomUUID()
        microcycleIds.push(microcycleId)

        tx.insert(microcycles).values({
          id: microcycleId,
          mesocycleId,
          weekNumber: microcycle.weekNumber,
          type: microcycle.type,
          startDate: microcycle.startDate,
          endDate: microcycle.endDate,
          targetVolumeKm: microcycle.targetVolumeKm,
          targetElevationGain: microcycle.targetElevationGain,
          targetDurationMin: null,
          notes: microcycle.notes,
          createdAt: now,
          updatedAt: now,
        }).run()
      })
    })

    return {
      groupTrainingPlanId,
      macrocycleId,
      mesocycleIds,
      microcycleIds,
    }
  })
}
