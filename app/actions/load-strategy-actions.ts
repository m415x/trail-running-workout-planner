'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db'
import { loadStrategies } from '@/db/load-strategy-schema'
import { athleteGroups, groupTrainingPlans } from '@/db/schema'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'
import type {
  AthleteGroupCode,
  LoadStrategyDraft,
  LoadStrategyFieldSources,
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

const loadStrategyFieldSourcesSchema = z.object({
  initialWeeklyVolumeKm: z.enum(['suggested', 'manual']),
  maximumWeeklyVolumeKm: z.enum(['suggested', 'manual']),
  sessionsPerWeek: z.enum(['suggested', 'manual']),
  maximumWeeklyIncreasePercentage: z.enum(['suggested', 'manual']),
  deloadPercentage: z.enum(['suggested', 'manual']),
  initialWeeklyElevationGain: z.enum(['suggested', 'manual']),
  maximumWeeklyElevationGain: z.enum(['suggested', 'manual']),
})

const createGroupPlanWithLoadStrategySchema = z.object({
  groupId: z.string().trim().min(1),
  groupCode: z.string().trim().min(2),
  goalType: z.enum(goalTypes),
  locale: z.enum(locales).default('es'),
  values: loadStrategyValuesSchema,
  fieldSources: loadStrategyFieldSourcesSchema,
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
  let rawFieldSources: unknown

  try {
    rawValues = JSON.parse(String(formData.get('values') ?? ''))
    rawFieldSources = JSON.parse(String(formData.get('fieldSources') ?? ''))
  } catch {
    return { error: 'No se pudieron interpretar los parámetros de carga' }
  }

  const parsed = createGroupPlanWithLoadStrategySchema.safeParse({
    groupId: formData.get('groupId'),
    groupCode: formData.get('groupCode'),
    goalType: formData.get('goalType'),
    locale: formData.get('locale'),
    values: rawValues,
    fieldSources: rawFieldSources,
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

    const strategy: LoadStrategyDraft = {
      context: {
        athleteGroup: resolvedGroupCode,
        goalType: data.goalType,
      },
      values: data.values,
      fieldSources: data.fieldSources as LoadStrategyFieldSources,
    }

    const validation = validateLoadStrategy(strategy)

    if (!validation.isValid) {
      return { error: validation.errors[0]?.message ?? 'La estrategia contiene valores inválidos' }
    }

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
        fieldSources: data.fieldSources,
        createdAt: now,
        updatedAt: now,
      }).run()
    })
  } catch (error) {
    console.error('Error creating group plan with load strategy:', error)
    return { error: 'No se pudo crear el plan grupal con su estrategia de carga' }
  }

  const detailPath = planningPath(data.locale, `/${planId}`)
  revalidatePath(planningPath(data.locale))
  redirect(detailPath)
}
