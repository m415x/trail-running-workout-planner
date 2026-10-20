/**
 * Pre-resolution candidate gate. Sessions with no athlete adjustment cannot
 * move into the requested period. A session with any own adjustment must
 * still be resolved against historical planning and its effective date.
 */
export function shouldEvaluateAthletePeriodSession(input: {
  readonly originalDate: string
  readonly startDate: string
  readonly endDate: string
  readonly hasAthleteAdjustment: boolean
}): boolean {
  // Neutral extraction: RED first, no behavior change until GREEN.
  void input
  return true
}
