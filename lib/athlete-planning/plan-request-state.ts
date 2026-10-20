export type AthletePlanRequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: T }
  | { status: 'empty' | 'error' | 'denied' }

export type AthletePlanRequestOutcome<T> = Exclude<AthletePlanRequestState<T>, { status: 'idle' | 'loading' }>

/**
 * In-memory request generation guard for client-facing Athlete Plan reads.
 * Starting revalidation hides previously authorized data synchronously.
 * Only the newest request may change what the UI displays.
 */
export function createAthletePlanRequestState<T>() {
  let generation = 0
  let state: AthletePlanRequestState<T> = { status: 'idle' }

  return {
    begin(): number {
      generation += 1
      state = { status: 'loading' }
      return generation
    },
    settle(requestGeneration: number, outcome: AthletePlanRequestOutcome<T>): void {
      if (requestGeneration !== generation) return
      state = outcome
    },
    current(): AthletePlanRequestState<T> {
      return state
    },
  }
}
