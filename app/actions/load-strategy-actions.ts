'use server'

import { localizeLoadIssue } from '@/features/planning/load-strategy-copy'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

import { db } from '@/db'
import { intensityStrategies } from '@/db/intensity-strategy-schema'
import { loadStrategies } from '@/db/load-strategy-schema'
import { sessionGenerationPreferences } from '@/db/session-generation-preferences-schema'
import {
  athleteGroups,
  groupTrainingPlans,
  macrocycles,
  planningModificationRecords,
} from '@/db/schema'
import { validateMacrocycleHorizon } from '@/lib/periodization/macrocycle-horizon'
import {
  deriveLoadStrategyFieldSources,
  getLoadStrategyModifications,
} from '@/lib/periodization/load-strategy-modifications'
import { suggestLoadStrategyForPlanningIntent } from '@/lib/periodization/load-strategy-recommender'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'
import { suggestIntensityStrategyForPlanningIntent } from '@/lib/periodization/intensity-strategy-recommender'
import { resolveBasePlanLegacyGoalType } from '@/lib/periodization/planning-intent'
import { defaultWeeklyGenerationPreferences } from '@/lib/session-generation/generation-preferences'
import { serializeSessionGenerationPreferences } from '@/lib/session-generation/generation-preferences-persistence'
import type {
  AthleteGroupCode,
  LoadStrategyDraft,
} from '@/types'

const CURRENT_TEAM_ID = 'team_1'
const locales = ['es', 'en'] as const
const planningIntents = ['development', 'base', 'maintenance'] as const

const loadStrategyValuesSchema = z.object({
  initialWeeklyVolumeKm: z.number(),
  maximumWeeklyVolumeKm: z.number(),
  maximumWeeklyIncreasePercentage: z.number(),
  deloadPercentage: z.number(),
  initialWeeklyElevationGain: z.number().nullable(),
  maximumWeeklyElevationGain: z.number().nullable(),
})

const createGroupPlanWithLoadStrategySchema = z.object({
  groupId: z.string().trim().min(1),
  groupCode: z.string().trim().min(2),
  planningIntent: z.enum(planningIntents),
  startDate: z.string(),
  endDate: z.string(),
  locale: z.enum(locales).default('es'),
  values: loadStrategyValuesSchema,
})

export interface CreateGroupPlanWithLoadStrategyState {
  error?: string
}

function planningPath(locale: string, suffix = '') {
  const base = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  return `${base}${suffix}`
}

export async function createGroupPlanWithLoadStrategy(
  _previousState: CreateGroupPlanWithLoadStrategyState,
  formData: FormData,
): Promise<CreateGroupPlanWithLoadStrategyState> {
  const t = await getTranslations({ locale: formData.get('locale') === 'en' ? 'en' : 'es', namespace: 'BasePlanning' })
  let rawValues: unknown

  try {
    rawValues = JSON.parse(String(formData.get('values') ?? ''))
  } catch {
    return { error: t('parseError') }
  }

  const parsed = createGroupPlanWithLoadStrategySchema.safeParse({
    groupId: formData.get('groupId'),
    groupCode: formData.get('groupCode'),
    planningIntent: formData.get('planningIntent'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    locale: formData.get('locale'),
    values: rawValues,
  })

  if (!parsed.success) {
    return { error: t('invalidError') }
  }

  const data = parsed.data
  const horizonValidation = validateMacrocycleHorizon({
    startDate: data.startDate,
    endDate: data.endDate,
  })

  if (!horizonValidation.isValid) {
    return { error: t('horizonInvalid') }
  }

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
      return { error: t('groupUnavailable') }
    }

    const resolvedGroupCode = `${group.categoryCode}${group.levelCode}` as AthleteGroupCode

    if (resolvedGroupCode !== data.groupCode) {
      return { error: t('groupMismatch') }
    }

    // Legacy schemas still store TrainingGoalType, but recommendations now use
    // PlanningIntent directly. Development maps to `performance`, never `race`.
    const legacyGoalType = resolveBasePlanLegacyGoalType(data.planningIntent)
    const suggestedStrategy = suggestLoadStrategyForPlanningIntent(
      resolvedGroupCode,
      data.planningIntent,
      legacyGoalType,
    )
    const suggestedIntensityStrategy = suggestIntensityStrategyForPlanningIntent(
      resolvedGroupCode,
      data.planningIntent,
      legacyGoalType,
    )
    const generationPreferences = serializeSessionGenerationPreferences(
      defaultWeeklyGenerationPreferences(),
    )
    const fieldSources = deriveLoadStrategyFieldSources(suggestedStrategy.values, data.values)
    const strategy: LoadStrategyDraft = {
      context: {
        athleteGroup: resolvedGroupCode,
        goalType: legacyGoalType,
      },
      values: data.values,
      fieldSources,
    }

    const validation = validateLoadStrategy(strategy)

    if (!validation.isValid) {
      return { error: validation.errors[0] ? localizeLoadIssue(validation.errors[0], strategy, t) : t('invalidError') }
    }

    const modifications = getLoadStrategyModifications(suggestedStrategy.values, data.values)

    planId = randomUUID()
    const strategyId = randomUUID()
    const macrocycleId = randomUUID()
    const now = new Date().toISOString()
    const planningIntentLabel = data.planningIntent === 'development'
      ? t('intents.development')
      : data.planningIntent === 'base'
        ? t('intents.base')
        : t('intents.maintenance')
    const title = t('planTitle', { group: resolvedGroupCode, intent: planningIntentLabel })

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
        goalType: legacyGoalType,
        initialWeeklyVolumeKm: data.values.initialWeeklyVolumeKm,
        maximumWeeklyVolumeKm: data.values.maximumWeeklyVolumeKm,
        maximumWeeklyIncreasePercentage: data.values.maximumWeeklyIncreasePercentage,
        deloadPercentage: data.values.deloadPercentage,
        initialWeeklyElevationGain: data.values.initialWeeklyElevationGain,
        maximumWeeklyElevationGain: data.values.maximumWeeklyElevationGain,
        fieldSources,
        createdAt: now,
        updatedAt: now,
      }).run()

      tx.insert(intensityStrategies).values({
        id: randomUUID(),
        groupTrainingPlanId: planId,
        goalType: legacyGoalType,
        defaultMethod: suggestedIntensityStrategy.values.defaultMethod,
        maximumIntenseSessionsPerWeek:
          suggestedIntensityStrategy.values.maximumIntenseSessionsPerWeek,
        minimumRecoveryDaysBetweenIntenseSessions:
          suggestedIntensityStrategy.values.minimumRecoveryDaysBetweenIntenseSessions,
        fieldSources: suggestedIntensityStrategy.fieldSources,
        createdAt: now,
        updatedAt: now,
      }).run()

      tx.insert(sessionGenerationPreferences).values({
        id: randomUUID(),
        groupTrainingPlanId: planId,
        frequencyMode: generationPreferences.frequencyMode,
        fixedSessionsPerWeek: generationPreferences.fixedSessionsPerWeek,
        weeklyPattern: generationPreferences.weeklyPattern,
        createdAt: now,
        updatedAt: now,
      }).run()

      tx.insert(macrocycles).values({
        id: macrocycleId,
        groupTrainingPlanId: planId,
        title,
        startDate: data.startDate,
        endDate: data.endDate,
        taperingWeeksCount: null,
        targetRaceName: null,
        targetRaceDistanceKm: null,
        targetRaceElevationGain: null,
        notes: null,
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
    return { error: t('createError') }
  }

  const detailPath = planningPath(data.locale, `/${planId}`)
  revalidatePath(planningPath(data.locale))
  redirect(detailPath)
}
