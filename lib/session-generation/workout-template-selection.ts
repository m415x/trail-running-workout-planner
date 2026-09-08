import { normalizeWorkoutTemplateSearchText } from '@/lib/workout-templates/workout-template-search'
import type { MicrocycleType, PeriodType } from '@/types/training/periodization.types'
import type { WeeklyTrainingSlot } from '@/types/training/session-generation.types'
import type {
  WorkoutTemplate,
  WorkoutTemplateCategory,
} from '@/types/training/workout-template.types'

const NON_COMPETITION_CATEGORIES: WorkoutTemplateCategory[] = [
  'endurance',
  'quality',
  'mountain',
  'technique',
  'recovery',
]

const PERIOD_CATEGORIES: Record<PeriodType, WorkoutTemplateCategory[]> = {
  general_preparatory: NON_COMPETITION_CATEGORIES,
  specific_preparatory: NON_COMPETITION_CATEGORIES,
  competitive: NON_COMPETITION_CATEGORIES,
  transition: ['endurance', 'technique', 'recovery'],
}

const PERIOD_CATEGORY_PRIORITY: Record<
  PeriodType,
  Partial<Record<WorkoutTemplateCategory, number>>
> = {
  general_preparatory: { endurance: 20, technique: 18, recovery: 15, mountain: 10, quality: 8 },
  specific_preparatory: { mountain: 20, quality: 18, endurance: 15, technique: 10, recovery: 8 },
  competitive: { quality: 20, endurance: 15, recovery: 15, technique: 10, mountain: 5 },
  transition: { recovery: 20, technique: 18, endurance: 15 },
}

const MICROCYCLE_CATEGORIES: Record<MicrocycleType, WorkoutTemplateCategory[]> = {
  base: NON_COMPETITION_CATEGORIES,
  development: NON_COMPETITION_CATEGORIES,
  shock: NON_COMPETITION_CATEGORIES,
  deload: ['endurance', 'technique', 'recovery'],
  tapering: ['endurance', 'quality', 'technique', 'recovery'],
  race: ['endurance', 'quality', 'technique', 'recovery', 'competition'],
}

export interface WorkoutTemplateSelectionInput {
  templates: WorkoutTemplate[]
  teamId: string
  period: PeriodType
  microcycleType: MicrocycleType
  slot: WeeklyTrainingSlot
}

export interface RankedWorkoutTemplate {
  template: WorkoutTemplate
  score: number
}

export interface WorkoutTemplateSelectionResult {
  selected: WorkoutTemplate | null
  candidates: RankedWorkoutTemplate[]
  warnings: string[]
}

/**
 * Ranks reusable templates for one planned weekly role without allowing a
 * template to override load or intensity planning.
 *
 * Team ownership, archive/deletion state and period/microcycle safety are hard
 * constraints. Slot categories and workout types establish role compatibility;
 * normalized tags only improve ranking between otherwise valid candidates.
 */
export function selectWorkoutTemplate(
  input: WorkoutTemplateSelectionInput,
): WorkoutTemplateSelectionResult {
  const candidates = input.templates
    .filter((template) => isAvailableForTeam(template, input.teamId))
    .filter((template) => isCompatibleWithPlanning(template, input))
    .filter((template) => isCompatibleWithRole(template, input.slot))
    .map((template) => ({
      template,
      score: getCompatibilityScore(template, input),
    }))
    .sort(compareRankedTemplates)

  if (candidates.length === 0) {
    return {
      selected: null,
      candidates: [],
      warnings: [
        `No hay una plantilla activa compatible con el rol ${input.slot.role}, ` +
          `el período ${input.period} y el microciclo ${input.microcycleType}.`,
      ],
    }
  }

  return {
    selected: candidates[0].template,
    candidates,
    warnings: [],
  }
}

function isAvailableForTeam(template: WorkoutTemplate, teamId: string) {
  return template.teamId === teamId && !template.isDeleted && template.archivedAt === null
}

function isCompatibleWithPlanning(
  template: WorkoutTemplate,
  input: WorkoutTemplateSelectionInput,
) {
  const isCompetitionTemplate = (
    template.category === 'competition' || template.sessionDefaults.type === 'Race'
  )

  if (input.slot.role === 'competition') {
    return (
      input.period === 'competitive' &&
      input.microcycleType === 'race' &&
      isCompetitionTemplate
    )
  }
  if (isCompetitionTemplate) return false

  return (
    PERIOD_CATEGORIES[input.period].includes(template.category) &&
    MICROCYCLE_CATEGORIES[input.microcycleType].includes(template.category)
  )
}

function isCompatibleWithRole(template: WorkoutTemplate, slot: WeeklyTrainingSlot) {
  return (
    slot.preferredWorkoutTypes.includes(template.sessionDefaults.type) ||
    slot.preferredTemplateCategories?.includes(template.category) === true
  )
}

function getCompatibilityScore(
  template: WorkoutTemplate,
  input: WorkoutTemplateSelectionInput,
) {
  const categoryMatch = input.slot.preferredTemplateCategories?.includes(template.category)
    ? 60
    : 0
  const typeIndex = input.slot.preferredWorkoutTypes.indexOf(template.sessionDefaults.type)
  const typeMatch = typeIndex >= 0 ? 50 - typeIndex : 0
  const normalizedTags = new Set(template.tags.map(normalizeWorkoutTemplateSearchText))
  const preferenceTags = [input.slot.role, input.period, input.microcycleType]
  const tagScore = preferenceTags.reduce(
    (score, tag) => score + (normalizedTags.has(normalizeWorkoutTemplateSearchText(tag)) ? 5 : 0),
    0,
  )
  const periodScore = PERIOD_CATEGORY_PRIORITY[input.period][template.category] ?? 0

  return categoryMatch + typeMatch + periodScore + tagScore
}

function compareRankedTemplates(left: RankedWorkoutTemplate, right: RankedWorkoutTemplate) {
  return (
    right.score - left.score ||
    left.template.sessionDefaults.title.localeCompare(
      right.template.sessionDefaults.title,
      'es',
      { sensitivity: 'base' },
    ) ||
    left.template.id.localeCompare(right.template.id)
  )
}
