import type { DirtyFormValue } from './dirty-form'
import {
  createDirtyFormGuardState,
  requestGuardedNavigation,
  resolveGuardedNavigation,
  type DirtyFormGuardState,
} from './dirty-form-guard-state'
import {
  createDirtyFormRegistration,
  type DirtyFormRegistration,
} from './dirty-form-registration'

export interface DashboardDirtyFormGuard {
  register(initialValue: DirtyFormValue): void
  update(currentValue: DirtyFormValue): void
  unregister(): void
  isDirty(): boolean
  markSaved(): void
  guardNavigation(navigate: () => void): void
  hasPendingNavigation(): boolean
  stay(): void
  discard(): void
}

export function createDashboardDirtyFormGuard(): DashboardDirtyFormGuard {
  const registration: DirtyFormRegistration = createDirtyFormRegistration()
  let navigationState: DirtyFormGuardState = createDirtyFormGuardState()

  return {
    register(initialValue) {
      registration.register(initialValue)
    },
    update(currentValue) {
      registration.update(currentValue)
    },
    unregister() {
      registration.unregister()
      navigationState = createDirtyFormGuardState()
    },
    isDirty() {
      return registration.isDirty()
    },
    markSaved() {
      registration.markSaved()
    },
    guardNavigation(navigate) {
      navigationState = requestGuardedNavigation(
        navigationState,
        registration.isDirty(),
        navigate,
      )
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
