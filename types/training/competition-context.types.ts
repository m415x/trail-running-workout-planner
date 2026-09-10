export interface CompetitionContext {
  /** Competition currently selected to condition this planning generation. */
  readonly primaryCompetition: {
    readonly name: string
    /** Competitive distance in kilometers. */
    readonly distanceKm: number
    /** Positive elevation gain in meters (m+). */
    readonly elevationGain?: number
  }
}
