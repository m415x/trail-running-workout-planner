/**
 * Request a fresh server-derived navigation projection after a browser resume.
 * Visibility and focus emitted together count as one resume; a later focus
 * event is a new opportunity to revalidate.
 */
export function createCoachNavigationResumeRefresh(refresh: () => void) {
  let suppressNextFocus = false

  return {
    onVisibilityChange(visible: boolean): void {
      if (!visible) {
        suppressNextFocus = false
        return
      }
      suppressNextFocus = true
      refresh()
    },

    onFocus(): void {
      if (suppressNextFocus) {
        suppressNextFocus = false
        return
      }
      refresh()
    },
  }
}
