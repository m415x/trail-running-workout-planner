export interface BeforeUnloadEventLike {
  preventDefault(): void
  returnValue: string | boolean
}

/**
 * Requests the browser-owned exit/reload confirmation only while meaningful
 * unsaved changes exist. Internal SPA navigation uses the application dialog
 * contract instead.
 */
export function applyBeforeUnloadProtection(
  isDirty: boolean,
  event: BeforeUnloadEventLike,
): void {
  if (!isDirty) return

  event.preventDefault()
  event.returnValue = true
}
