export type GuardedNavigationEffect =
  | { type: 'navigate' }
  | { type: 'confirm-discard' }

export type BeforeUnloadGuardEffect = {
  preventDefault: boolean
}

/**
 * Maps dirty-form state to the effect expected from an internal navigation
 * adapter. UI integrations decide how to render the discard confirmation and
 * only navigate after the user explicitly confirms it.
 */
export function guardedNavigationEffect(isDirty: boolean): GuardedNavigationEffect {
  return isDirty ? { type: 'confirm-discard' } : { type: 'navigate' }
}

/**
 * Keeps browser-owned exit/reload protection separate from SPA navigation.
 */
export function beforeUnloadGuardEffect(isDirty: boolean): BeforeUnloadGuardEffect {
  return { preventDefault: isDirty }
}
