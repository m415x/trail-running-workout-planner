import {
  createPendingNavigation,
  resolvePendingNavigation,
  type NavigationContinuation,
  type PendingNavigationResolution,
} from './dirty-form-navigation'

export interface DirtyFormGuardState {
  pendingNavigation: NavigationContinuation | null
}

export function createDirtyFormGuardState(): DirtyFormGuardState {
  return { pendingNavigation: null }
}

/**
 * Clean navigation runs immediately. Dirty navigation is retained so the UI
 * can ask whether to stay or discard before continuing.
 */
export function requestGuardedNavigation(
  state: DirtyFormGuardState,
  isDirty: boolean,
  navigate: NavigationContinuation,
): DirtyFormGuardState {
  const pending = createPendingNavigation(isDirty, navigate)

  return {
    ...state,
    pendingNavigation: pending.continueNavigation,
  }
}

/**
 * Resolves and clears the pending navigation. The caller owns rendering the
 * confirmation UI; this state contract owns only navigation semantics.
 */
export function resolveGuardedNavigation(
  state: DirtyFormGuardState,
  resolution: PendingNavigationResolution,
): DirtyFormGuardState {
  resolvePendingNavigation(state.pendingNavigation, resolution)

  return {
    ...state,
    pendingNavigation: null,
  }
}
