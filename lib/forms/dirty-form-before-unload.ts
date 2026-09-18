export interface BeforeUnloadEventLike {
  preventDefault(): void
  returnValue: string | boolean
}

export function applyBeforeUnloadProtection(
  isDirty: boolean,
  event: BeforeUnloadEventLike,
): void {
  if (!isDirty) return

  event.preventDefault()
  event.returnValue = true
}
