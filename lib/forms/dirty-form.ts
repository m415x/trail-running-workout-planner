export type DirtyFormValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | DirtyFormValue[]
  | { [key: string]: DirtyFormValue }

const UNDEFINED_SENTINEL = '__dirty_form_undefined__'

function normalizeDirtyFormValue(value: DirtyFormValue): unknown {
  if (value === undefined) return { [UNDEFINED_SENTINEL]: true }

  if (Array.isArray(value)) return value.map(normalizeDirtyFormValue)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeDirtyFormValue(nestedValue)]),
    )
  }

  return value
}

/**
 * Produces a stable structural representation for persisted/initial and current
 * form values. Object key order is irrelevant; array order and primitive value
 * types remain meaningful. Undefined remains distinct from a missing property.
 */
export function dirtyFormFingerprint(value: DirtyFormValue): string {
  return JSON.stringify(normalizeDirtyFormValue(value))
}

/**
 * Dirty means the normalized current state differs from the explicit baseline.
 * Returning values to their baseline therefore returns the form to clean.
 */
export function isDirtyFormState(baseline: DirtyFormValue, current: DirtyFormValue): boolean {
  return dirtyFormFingerprint(baseline) !== dirtyFormFingerprint(current)
}

export type GuardedNavigationDecision = 'proceed' | 'confirm'

/**
 * Pure navigation policy used by UI adapters: clean forms proceed immediately;
 * dirty forms must ask the user whether to stay or discard changes.
 */
export function guardedNavigationDecision(isDirty: boolean): GuardedNavigationDecision {
  return isDirty ? 'confirm' : 'proceed'
}

/**
 * Browsers only need beforeunload protection while meaningful unsaved changes
 * exist. The browser owns the native exit/reload prompt.
 */
export function shouldProtectBeforeUnload(isDirty: boolean): boolean {
  return isDirty
}
