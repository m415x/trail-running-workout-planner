export interface AthleteEditSubmitGuardState {
  pending: boolean
  error?: string
  wasPending: boolean
}

export function shouldMarkAthleteEditSaved({
  pending,
  error,
  wasPending,
}: AthleteEditSubmitGuardState): boolean {
  return wasPending && !pending && !error
}
