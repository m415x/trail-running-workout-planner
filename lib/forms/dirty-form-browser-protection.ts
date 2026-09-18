import { applyBeforeUnloadProtection } from './dirty-form-before-unload'

interface BeforeUnloadEventLike {
  preventDefault(): void
  returnValue: string | boolean
}

type BeforeUnloadHandler = (event: BeforeUnloadEventLike) => void
type SubscribeBeforeUnload = (handler: BeforeUnloadHandler) => () => void

export interface DirtyFormBrowserProtection {
  start(): void
  stop(): void
}

export function createDirtyFormBrowserProtection(
  readDirty: () => boolean,
  subscribe: SubscribeBeforeUnload,
): DirtyFormBrowserProtection {
  let unsubscribe: (() => void) | null = null

  return {
    start() {
      if (unsubscribe) return

      unsubscribe = subscribe((event) => {
        applyBeforeUnloadProtection(readDirty(), event)
      })
    },
    stop() {
      unsubscribe?.()
      unsubscribe = null
    },
  }
}
