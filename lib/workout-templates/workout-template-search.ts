import type {
  WorkoutTemplate,
  WorkoutTemplateSearchCriteria,
} from '@/types'

const MAX_TAGS = 10
const MAX_TAG_LENGTH = 30

/** Produces case- and accent-insensitive text for catalogue matching. */
export function normalizeWorkoutTemplateSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')
}

/**
 * Normalizes free-form template tags while preserving a readable first value.
 *
 * Empty and duplicated tags are removed. Limits prevent tags from becoming an
 * unbounded substitute for structured template data.
 */
export function normalizeWorkoutTemplateTags(tags: string[]) {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const rawTag of tags) {
    const tag = rawTag.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH)
    const comparisonKey = normalizeWorkoutTemplateSearchText(tag)
    if (!tag || seen.has(comparisonKey)) continue

    seen.add(comparisonKey)
    normalized.push(tag)
    if (normalized.length === MAX_TAGS) break
  }

  return normalized
}

function searchableText(template: WorkoutTemplate) {
  const structure = template.sessionDefaults.structure

  return normalizeWorkoutTemplateSearchText([
    template.sessionDefaults.title,
    template.sessionDefaults.type,
    template.category,
    ...template.tags,
    template.sessionDefaults.notes,
    template.prescriptionDefaults.notes,
    structure?.preliminaryExercises,
    structure?.warmup,
    structure?.mainBlock,
    structure?.cooldown,
  ].filter((value): value is string => Boolean(value)).join(' '))
}

/**
 * Evaluates in-memory catalogue filters with the same semantics expected from
 * persistence: OR within each filter and AND between different filters.
 */
export function matchesWorkoutTemplateSearch(
  template: WorkoutTemplate,
  criteria: WorkoutTemplateSearchCriteria,
) {
  const archive = criteria.archive ?? 'active'
  if (archive === 'active' && template.archivedAt !== null) return false
  if (archive === 'archived' && template.archivedAt === null) return false

  if (
    criteria.categories?.length
    && !criteria.categories.includes(template.category)
  ) {
    return false
  }

  if (
    criteria.workoutTypes?.length
    && !criteria.workoutTypes.includes(template.sessionDefaults.type)
  ) {
    return false
  }

  const normalizedTemplateTags = template.tags.map(normalizeWorkoutTemplateSearchText)
  if (
    criteria.tags?.length
    && !criteria.tags.some((tag) => (
      normalizedTemplateTags.includes(normalizeWorkoutTemplateSearchText(tag))
    ))
  ) {
    return false
  }

  const queryTerms = normalizeWorkoutTemplateSearchText(criteria.query ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const haystack = searchableText(template)

  return queryTerms.every((term) => haystack.includes(term))
}
