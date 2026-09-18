import { createDirtyFormBaseline, type DirtyFormBaseline } from './dirty-form-baseline'
import {
  createDirtyFormGuardState,
  requestGuardedNavigation,
  resolveGuardedNavigation,
  type DirtyFormGuardState,
} from './dirty-form-guard-state'
import type { DirtyFormValue } from './dirty-form'

export interface DirtyFormGuardController {
  isDirty(): boolean
  markSaved(): void
  guardNavigation(navigate: () => void): void
  hasPendingNavigation(): boolean
  stay(): void
  discard(): void
}

/**
 * Composes baseline comparison with pending-navigation semantics while keeping
 * React/Next adapters thin. The current-value reader prevents stale snapshots.
 */
export function createDirtyFormGuardController(
  initial: DirtyFormValue,
  readCurrent: () => DirtyFormValue,
): DirtyFormGuardController {
  const baseline: DirtyFormBaseline = createDirtyFormBaseline(initial)
  let navigationState: DirtyFormGuardState = createDirtyFormGuardState()

  return {
    isDirty() {
      return baseline.isDirty(readCurrent())
    },
    markSaved() {
      baseline.reset(readCurrent())
    },
    guardNavigation(navigate) {
      navigationState = requestGuardedNavigation(navigationState, baseline.isDirty(readCurrent()), navigate)
    },
    hasPendingNavigation() {
      return navigationState.pendingNavigation !== null
    },
    stay() {
      navigationState = resolveGuardedNavigation(navigationState, 'stay')
    },
    discard() {
      navigationState = resolveGuardedNavigation(navigationState, 'discard')
    },
  }
}
