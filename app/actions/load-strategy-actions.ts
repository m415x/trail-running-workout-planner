'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { loadStrategies } from '@/db/load-strategy-schema'
import { athleteGroups, groupTrainingPlans, planningModificationRecords } from '@/db/schema'
import {
  deriveLoadStrategyFieldSources,
  getLoadStrategyModifications,
} from '@/lib/periodization/load-strategy-modifications'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'
import type {
  AthleteGroupCode,
  LoadStrategyDraft,
  TrainingGoalType,
} from '@/types'

const CURRENT_TEAM_ID = 'team_1'
const locales = ['es', 'en'] as const
const goalTypes = ['race', 'performance', 'base', 'maintenance', 'custom'] as const

const loadStrategyValuesSchema = z.object({
  initialWeeklyVolumeKm: z.number(),
  maximumWeeklyVolumeKm: z.number(),
  sessionsPerWeek: z.number(),
  maximumWeeklyIncreasePercentage: z.number(),
  deloadPercentage: z.number(),
  initialWeeklyElevationGain: z.number().nullable(),
  maximumWeeklyElevationGain: z.number().nullable(),
})

const createGroupPlanWithLoadStrategySchema = z.object({
  groupId: z.string().trim().min(1),
  groupCode: z.string().trim().min(2),
  goalType: z.enum(goalTypes),
  locale: z.enum(locales).default('es'),
  values: loadStrategyValuesSchema,
})

export interface CreateGroupPlanWithLoadStrategyState {
  error?: string
}

const goalLabels: Record<TrainingGoalType, string> = {
  race: 'Carrera',
  performance: 'Rendimiento',
  base: 'Base aeróbica',
  maintenance: 'Mantenimiento',
  custom: 'Objetivo personalizado',
}

function planningPath(locale: string, suffix = '') {
  const base = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  return `${base}${suffix}`
}

export async function createGroupPlanWithLoadStrategy(
  _previousState: CreateGroupPlanWithLoadStrategyState,
  formData: FormData,
): Promise<CreateGroupPlanWithLoadStrategyState> {
  let rawValues: unknown

  try {
    rawValues = JSON.parse(String(formData.get('values') ?? ''))
  } catch {
    return { error: 'No se pudieron interpretar los parámetros de carga' }
  }

  const parsed = createGroupPlanWithLoadStrategySchema.safeParse({
    groupId: formData.get('groupId'),
    groupCode: formData.get('groupCode'),
    goalType: formData.get('goalType'),
    locale: formData.get('locale'),
    values: rawValues,
  })

  if (!parsed.success) {
    return { error: 'Revisá los datos de la estrategia antes de continuar' }
  }

  const data = parsed.data
  let planId: string

  try {
    const group = db.query.athleteGroups.findFirst({
      where: and(
        eq(athleteGroups.id, data.groupId),
        eq(athleteGroups.teamId, CURRENT_TEAM_ID),
        eq(athleteGroups.isDeleted, false),
        eq(athleteGroups.isActive, true),
      ),
    }).sync()

    if (!group) {
      return { error: 'El grupo seleccionado no está disponible' }
    }

    const resolvedGroupCode = `${group.categoryCode}${group.levelCode}` as AthleteGroupCode

    if (resolvedGroupCode !== data.groupCode) {
      return { error: 'El grupo seleccionado no coincide con la estrategia configurada' }
    }

    const suggestedStrategy = suggestLoadStrategy(resolvedGroupCode, data.goalType)
    const fieldSources = deriveLoadStrategyFieldSources(suggestedStrategy.values, data.values)
    const strategy: LoadStrategyDraft = {
      context: {
        athleteGroup: resolvedGroupCode,
        goalType: data.goalType,
      },
      values: data.values,
      fieldSources,
    }

    const validation = validateLoadStrategy(strategy)

    if (!validation.isValid) {
      return { error: validation.errors[0]?.message ?? 'La estrategia contiene valores inválidos' }
    }

    const modifications = getLoadStrategyModifications(suggestedStrategy.values, data.values)

    planId = randomUUID()
    const strategyId = randomUUID()
    const now = new Date().toISOString()
    const title = `Plan ${resolvedGroupCode} · ${goalLabels[data.goalType]}`

    db.transaction((tx) => {
      tx.insert(groupTrainingPlans).values({
        id: planId,
        groupId: group.id,
        title,
        status: 'draft',
        notes: null,
        createdAt: now,
        updatedAt: now,
      }).run()

      tx.insert(loadStrategies).values({
        id: strategyId,
        groupTrainingPlanId: planId,
        goalType: data.goalType,
        initialWeeklyVolumeKm: data.values.initialWeeklyVolumeKm,
        maximumWeeklyVolumeKm: data.values.maximumWeeklyVolumeKm,
        sessionsPerWeek: data.values.sessionsPerWeek,
        maximumWeeklyIncreasePercentage: data.values.maximumWeeklyIncreasePercentage,
        deloadPercentage: data.values.deloadPercentage,
        initialWeeklyElevationGain: data.values.initialWeeklyElevationGain,
        maximumWeeklyElevationGain: data.values.maximumWeeklyElevationGain,
        fieldSources,
        createdAt: now,
        updatedAt: now,
      }).run()

      for (const modification of modifications) {
        tx.insert(planningModificationRecords).values({
          id: randomUUID(),
          groupTrainingPlanId: planId,
          microcycleId: null,
          field: modification.field,
          previousValue: modification.previousValue,
          newValue: modification.newValue,
          changedByUserId: null,
          createdAt: now,
          updatedAt: now,
        }).run()
      }
    })
  } catch (error) {
    console.error('Error creating group plan with load strategy:', error)
    return { error: 'No se pudo crear el plan grupal con su estrategia de carga' }
  }

  const detailPath = planningPath(data.locale, `/${planId}`)
  revalidatePath(planningPath(data.locale))
  redirect(detailPath)
}
