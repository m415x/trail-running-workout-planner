import { dirtyFormFingerprint, DirtyFormValue } from './dirty-form'

export interface DirtyFormBaseline {
  isDirty(current: DirtyFormValue): boolean
  reset(nextBaseline: DirtyFormValue): void
}

/**
 * Owns the explicit persisted/initial baseline for a form.
 *
 * Call reset only after a successful save. Failed saves leave the previous
 * baseline untouched, so unsaved changes remain protected.
 */
export function createDirtyFormBaseline(initial: DirtyFormValue): DirtyFormBaseline {
  let baselineFingerprint = dirtyFormFingerprint(initial)

  return {
    isDirty(current) {
      return baselineFingerprint !== dirtyFormFingerprint(current)
    },
    reset(nextBaseline) {
      baselineFingerprint = dirtyFormFingerprint(nextBaseline)
    },
  }
}
