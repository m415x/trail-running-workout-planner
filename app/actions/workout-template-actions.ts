'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'
import { trainingLocations, workouts } from '@/db/schema'
import {
  type WorkoutTemplatePersistenceValues,
} from '@/lib/workout-templates/workout-template-persistence'
import { matchesWorkoutTemplateSearch, normalizeWorkoutTemplateTags } from '@/lib/workout-templates/workout-template-search'
import { createWorkoutTemplateActionComposition } from '@/lib/workout-templates/workout-template-action-composition'
import { validateWorkoutTemplateDefaults, type WorkoutTemplateDefaultField } from '@/lib/workout-templates/workout-template-validator'
import type {
  IntensityMethod,
  IntensityZone,
  TrainingIntensity,
  WorkoutTemplate,
  WorkoutTemplateCategory,
  WorkoutTemplateDraft,
  WorkoutTemplateSearchCriteria,
  WorkoutType,
} from '@/types'

function workoutTemplateActionComposition() {
  return createWorkoutTemplateActionComposition({
    database: db,
    readAccess: async () => {
      const supabase = await createSupabaseServerClient()
      return readEptSessionAccessState(supabase.auth, createExternalIdentityLookup())
    },
    resolveActiveTeam: userId => createActiveTeamNextServerContext().resolve(userId),
    authorize: (access, request) => createH4aNextServerAuthorizationBoundary().authorize(access, request),
  })
}

export interface WorkoutTemplateFormState {
  error?: string
  fieldErrors?: Partial<Record<WorkoutTemplateDefaultField, string>>
  values?: Record<string, string>
  submissionKey?: number
}

function formValues(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()]
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .filter(([key]) => !key.startsWith('$ACTION_')),
  )
}

function optionalText(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() || null
}

function optionalNumber(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim()
  return value ? Number(value) : null
}

function templatesPath(locale: string) {
  return locale === 'es' ? '/dashboard/templates' : `/${locale}/dashboard/templates`
}

function templateEditPath(locale: string, templateId: string) {
  return `${templatesPath(locale)}/${templateId}/edit`
}

function draftFromFormData(formData: FormData, teamId: string): WorkoutTemplateDraft {
  const intensityMethod = optionalText(formData, 'intensityMethod') as IntensityMethod | null
  let intensity: TrainingIntensity | null = null

  if (intensityMethod === 'hr_zone') {
    intensity = {
      method: 'hr_zone',
      zone: optionalText(formData, 'zone') as IntensityZone,
    }
  } else if (intensityMethod === 'reference_percentage') {
    intensity = {
      method: 'reference_percentage',
      referencePercentage: optionalNumber(formData, 'referencePercentage') as number,
    }
  }

  const structure = {
    preliminaryExercises: optionalText(formData, 'preliminaryExercises'),
    warmup: optionalText(formData, 'warmup'),
    mainBlock: optionalText(formData, 'mainBlock'),
    cooldown: optionalText(formData, 'cooldown'),
  }
  const hasStructure = Object.values(structure).some(Boolean)

  return {
    teamId,
    category: formData.get('category')?.toString() as WorkoutTemplateCategory,
    tags: (formData.get('tags')?.toString() ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
    sessionDefaults: {
      title: formData.get('title')?.toString() ?? '',
      type: formData.get('type')?.toString() as WorkoutType,
      locationKey: optionalText(formData, 'locationKey'),
      trackPath: optionalText(formData, 'trackPath'),
      structure: hasStructure ? structure : null,
      notes: optionalText(formData, 'notes'),
    },
    prescriptionDefaults: {
      distanceKm: optionalNumber(formData, 'distanceKm'),
      durationMin: optionalNumber(formData, 'durationMin'),
      elevationGain: optionalNumber(formData, 'elevationGain'),
      intensity,
      notes: optionalText(formData, 'prescriptionNotes'),
    },
  }
}

function resolveIntensity(row: typeof workouts.$inferSelect): TrainingIntensity | null {
  if (row.intensityMethod === 'hr_zone' && row.zone) return { method: 'hr_zone', zone: row.zone }
  if (row.intensityMethod === 'reference_percentage' && row.referencePercentage !== null) {
    return { method: 'reference_percentage', referencePercentage: row.referencePercentage }
  }
  return null
}

function toWorkoutTemplate(row: typeof workouts.$inferSelect): WorkoutTemplate {
  return {
    id: row.id,
    teamId: row.teamId,
    category: row.category,
    tags: row.tags,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isDeleted: row.isDeleted,
    sessionDefaults: {
      title: row.title,
      type: row.type,
      locationKey: row.locationKey,
      trackPath: row.trackPath,
      structure: row.structure,
      notes: row.notes,
    },
    prescriptionDefaults: {
      distanceKm: row.distance,
      durationMin: row.time,
      elevationGain: row.gain,
      intensity: resolveIntensity(row),
      notes: row.prescriptionNotes,
    },
  }
}

function persistenceValues(draft: WorkoutTemplateDraft, teamId: string): WorkoutTemplatePersistenceValues {
  const intensity = draft.prescriptionDefaults.intensity
  return {
    teamId: teamId,
    category: draft.category,
    tags: normalizeWorkoutTemplateTags(draft.tags),
    title: draft.sessionDefaults.title.trim(),
    type: draft.sessionDefaults.type,
    locationKey: draft.sessionDefaults.locationKey,
    trackPath: draft.sessionDefaults.trackPath,
    structure: draft.sessionDefaults.structure,
    notes: draft.sessionDefaults.notes,
    distance: draft.prescriptionDefaults.distanceKm,
    time: draft.prescriptionDefaults.durationMin,
    gain: draft.prescriptionDefaults.elevationGain,
    intensityMethod: intensity?.method ?? null,
    zone: intensity?.method === 'hr_zone' ? intensity.zone : null,
    referencePercentage: intensity?.method === 'reference_percentage' ? intensity.referencePercentage : null,
    prescriptionNotes: draft.prescriptionDefaults.notes,
  }
}

/**
 * Returns the reusable workout catalogue owned by one team.
 *
 * Deleted records are always excluded. Catalogue criteria use accent-insensitive
 * text matching and AND semantics between different filter groups.
 */
export async function getWorkoutTemplates(
  criteria: WorkoutTemplateSearchCriteria = {},
) {
  const authorized = await workoutTemplateActionComposition().authorize()
  if (!authorized) throw new Error('No autorizado')
  const teamId = authorized.teamId
  const rows = db.query.workouts.findMany({
    where: and(eq(workouts.teamId, teamId), eq(workouts.isDeleted, false)),
    orderBy: (table, { asc }) => [asc(table.title)],
  }).sync()
  const catalogue = rows.map(toWorkoutTemplate)

  return {
    templates: catalogue.filter((template) => matchesWorkoutTemplateSearch(template, criteria)),
    availableTags: [...new Set(catalogue.flatMap((template) => template.tags))]
      .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' })),
  }
}

/** Returns one team-owned template or undefined when it is unavailable. */
export async function getWorkoutTemplateById(templateId: string) {
  const authorized = await workoutTemplateActionComposition().authorize()
  if (!authorized) return undefined
  const row = db.query.workouts.findFirst({
    where: and(
      eq(workouts.id, templateId),
      eq(workouts.teamId, authorized.teamId),
      eq(workouts.isDeleted, false),
    ),
  }).sync()

  return row ? toWorkoutTemplate(row) : undefined
}

/** Returns the lightweight lookup data required by the template form. */
export async function getWorkoutTemplateFormOptions() {
  const authorized = await workoutTemplateActionComposition().authorize()
  if (!authorized) throw new Error('No autorizado')
  return {
    locations: db.select({ key: trainingLocations.key, name: trainingLocations.name })
      .from(trainingLocations)
      .orderBy(trainingLocations.name)
      .all(),
  }
}

/** Validates and persists a new reusable workout template for the current team. */
export async function createWorkoutTemplate(
  previousState: WorkoutTemplateFormState,
  formData: FormData,
): Promise<WorkoutTemplateFormState> {
  const locale = formData.get('locale')?.toString() === 'en' ? 'en' : 'es'
  const authorized = await workoutTemplateActionComposition().authorize()
  if (!authorized) return { error: 'No autorizado' }
  const draft = draftFromFormData(formData, authorized.teamId)
  const validation = validateWorkoutTemplateDefaults(draft)

  if (!validation.isValid) {
    const fieldErrors: WorkoutTemplateFormState['fieldErrors'] = {}
    for (const issue of validation.errors) fieldErrors[issue.field] ??= issue.message
    return {
      error: 'Revisá los campos indicados antes de guardar.',
      fieldErrors,
      values: formValues(formData),
      submissionKey: (previousState.submissionKey ?? 0) + 1,
    }
  }

  try {
    const created = await workoutTemplateActionComposition().service().create(
      randomUUID(),
      persistenceValues(draft, authorized.teamId),
    )
    if (created.status !== 'allowed') return { error: 'No autorizado' }
  } catch (error) {
    console.error('Error creating workout template:', error)
    return {
      error: 'No se pudo crear la plantilla. Intentá nuevamente.',
      values: formValues(formData),
      submissionKey: (previousState.submissionKey ?? 0) + 1,
    }
  }

  const path = templatesPath(locale)
  revalidatePath(path)
  redirect(path)
}

/** Validates and updates one template without changing its identity or archive state. */
export async function updateWorkoutTemplate(
  previousState: WorkoutTemplateFormState,
  formData: FormData,
): Promise<WorkoutTemplateFormState> {
  const templateId = formData.get('templateId')?.toString()
  const locale = formData.get('locale')?.toString() === 'en' ? 'en' : 'es'
  const authorized = await workoutTemplateActionComposition().authorize()
  if (!authorized) return { error: 'No autorizado' }
  const draft = draftFromFormData(formData, authorized.teamId)
  const validation = validateWorkoutTemplateDefaults(draft)

  if (!templateId) return { error: 'No se pudo identificar la plantilla.' }

  if (!validation.isValid) {
    const fieldErrors: WorkoutTemplateFormState['fieldErrors'] = {}
    for (const issue of validation.errors) fieldErrors[issue.field] ??= issue.message
    return {
      error: 'Revisá los campos indicados antes de guardar.',
      fieldErrors,
      values: formValues(formData),
      submissionKey: (previousState.submissionKey ?? 0) + 1,
    }
  }

  try {
    const template = await getWorkoutTemplateById(templateId)
    if (!template) return { error: 'Plantilla no encontrada.' }

    const updated = await workoutTemplateActionComposition().service().update(
      templateId,
      persistenceValues(draft, authorized.teamId),
    )
    if (updated.status !== 'allowed') return { error: 'Plantilla no encontrada.' }
  } catch (error) {
    console.error('Error updating workout template:', error)
    return {
      error: 'No se pudo actualizar la plantilla. Intentá nuevamente.',
      values: formValues(formData),
      submissionKey: (previousState.submissionKey ?? 0) + 1,
    }
  }

  const path = templatesPath(locale)
  revalidatePath(path)
  redirect(path)
}

/** Creates an active, independent copy and opens it for review. */
export async function duplicateWorkoutTemplate(formData: FormData) {
  const authorized = await workoutTemplateActionComposition().authorize()
  if (!authorized) throw new Error('No autorizado')
  const templateId = formData.get('templateId')?.toString()
  const locale = formData.get('locale')?.toString() === 'en' ? 'en' : 'es'
  if (!templateId) redirect(templatesPath(locale))

  const duplicateId = randomUUID()
  const duplicated = await workoutTemplateActionComposition().service().duplicate(
    templateId,
    duplicateId,
    locale === 'es' ? 'Copia de' : 'Copy of',
  )
  if (duplicated.status !== 'allowed') redirect(templatesPath(locale))

  revalidatePath(templatesPath(locale))
  redirect(templateEditPath(locale, duplicateId))
}

/** Archives or reactivates a team-owned template without deleting its history. */
export async function setWorkoutTemplateArchiveStatus(formData: FormData) {
  const authorized = await workoutTemplateActionComposition().authorize()
  if (!authorized) throw new Error('No autorizado')
  const templateId = formData.get('templateId')?.toString()
  const shouldArchive = formData.get('archive')?.toString() === 'true'
  const locale = formData.get('locale')?.toString() === 'en' ? 'en' : 'es'
  if (!templateId) return

  const changed = await workoutTemplateActionComposition().service().archive(templateId, shouldArchive)
  if (changed.status !== 'allowed') return

  revalidatePath(templatesPath(locale))
  revalidatePath(`${locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`}/new`)
}
