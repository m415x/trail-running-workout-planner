import { createDirtyFormBaseline, type DirtyFormBaseline } from './dirty-form-baseline'
import type { DirtyFormValue } from './dirty-form'

export interface DirtyFormRegistration {
  register(initialValue: DirtyFormValue): void
  update(currentValue: DirtyFormValue): void
  isDirty(): boolean
  markSaved(): void
  unregister(): void
}

export function createDirtyFormRegistration(): DirtyFormRegistration {
  let baseline: DirtyFormBaseline | null = null
  let currentValue: DirtyFormValue | null = null

  return {
    register(initialValue) {
      baseline = createDirtyFormBaseline(initialValue)
      currentValue = initialValue
    },
    update(nextValue) {
      currentValue = nextValue
    },
    isDirty() {
      return baseline !== null
        && currentValue !== null
        && baseline.isDirty(currentValue)
    },
    markSaved() {
      if (baseline !== null && currentValue !== null) {
        baseline.reset(currentValue)
      }
    },
    unregister() {
      baseline = null
      currentValue = null
    },
  }
}
