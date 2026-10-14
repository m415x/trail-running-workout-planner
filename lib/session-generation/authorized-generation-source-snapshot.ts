import { isDeepStrictEqual } from 'node:util'

type Source<T> = { status: 'allowed'; value: T } | { status: 'denied' } | { status: 'unavailable' }

type Plan = { id: string; teamId: string; [key: string]: unknown }
type Template = { teamId: string; [key: string]: unknown }

export interface AuthorizedGenerationSources {
  plan: Source<Plan>
  preferences: Source<unknown>
  templates: Source<Template[]>
  competitions: Source<unknown>
}

export interface CanonicalGenerationSources {
  teamId: string
  plan: unknown
  preferences: unknown
  templates: unknown
  competitions: unknown
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, part]) => [key, normalize(part)]))
  }
  return value
}

/** Pure source contract: never substitutes unavailable or denied inputs with empty values. */
export function resolveAuthorizedGenerationSources(
  activeTeamId: string,
  sources: AuthorizedGenerationSources,
): { status: 'denied' | 'unavailable' } | { status: 'allowed'; canonical: CanonicalGenerationSources } {
  if (!sources.plan || !sources.preferences || !sources.templates || !sources.competitions) {
    return { status: 'unavailable' }
  }
  if ([sources.plan, sources.preferences, sources.templates, sources.competitions]
    .some(source => source.status === 'denied')) return { status: 'denied' }
  if (sources.plan.status !== 'allowed' || sources.preferences.status !== 'allowed'
    || sources.templates.status !== 'allowed' || sources.competitions.status !== 'allowed') {
    return { status: 'unavailable' }
  }
  if (!activeTeamId || sources.plan.value.teamId !== activeTeamId
    || sources.templates.value.some(template => template.teamId !== activeTeamId)) {
    return { status: 'denied' }
  }
  return { status: 'allowed', canonical: {
    teamId: activeTeamId,
    plan: normalize(sources.plan.value),
    preferences: normalize(sources.preferences.value),
    templates: normalize(sources.templates.value),
    competitions: normalize(sources.competitions.value),
  } }
}

export function sameCanonicalGenerationSources(
  left: CanonicalGenerationSources,
  right: CanonicalGenerationSources,
): boolean {
  return isDeepStrictEqual(left, right)
}
