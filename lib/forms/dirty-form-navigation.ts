export type GuardedNavigationEffect =
  | { type: 'navigate' }
  | { type: 'confirm-discard' }

export type BeforeUnloadGuardEffect = {
  preventDefault: boolean
}

export type NavigationContinuation = () => void

export interface PendingNavigation {
  effect: GuardedNavigationEffect
  continueNavigation: NavigationContinuation | null
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
 * Runs clean navigation immediately. Dirty navigation is retained as a
 * continuation until the user explicitly decides whether to stay or discard.
 */
export function createPendingNavigation(
  isDirty: boolean,
  navigate: NavigationContinuation,
): PendingNavigation {
  const effect = guardedNavigationEffect(isDirty)

  if (effect.type === 'navigate') {
    navigate()
    return { effect, continueNavigation: null }
  }

  return { effect, continueNavigation: navigate }
}

export type PendingNavigationResolution = 'stay' | 'discard'

/**
 * Resolves a pending dirty navigation exactly once from the caller's point of
 * view. The caller clears its stored continuation with the returned null.
 */
export function resolvePendingNavigation(
  continuation: NavigationContinuation | null,
  resolution: PendingNavigationResolution,
): null {
  if (resolution === 'discard') continuation?.()
  return null
}

/**
 * Keeps browser-owned exit/reload protection separate from SPA navigation.
 */
export function beforeUnloadGuardEffect(isDirty: boolean): BeforeUnloadGuardEffect {
  return { preventDefault: isDirty }
}
