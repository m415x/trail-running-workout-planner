import {
  TRAINING_LOAD_SIGNAL_RULE_VERSION,
  type AthleteTrainingLoadState,
  type InternalLoadSignal,
} from '@/types'

/**
 * Converts the longitudinal internal-load state into the semantic signal used by
 * cross-domain review. The balance remains descriptive: a negative balance means
 * short-term load is above the long-term baseline, not fatigue or injury risk.
 */
export function deriveInternalLoadSignal(
  state: Omit<AthleteTrainingLoadState, 'semanticSignal'>,
): InternalLoadSignal {
  const latest = state.latest
  const availableBalance =
    state.status === 'available' &&
    latest?.status === 'available' &&
    latest.loadBalanceAu !== null

  const signalState = !availableBalance
    ? 'insufficient_data'
    : latest.loadBalanceAu < 0
      ? 'recent_load_above_baseline'
      : 'stable_or_lower'

  return {
    state: signalState,
    startDate: state.startDate,
    endDate: state.endDate,
    sourceRuleVersion: state.ruleVersion,
    signalRuleVersion: TRAINING_LOAD_SIGNAL_RULE_VERSION,
    insufficientReasons: signalState === 'insufficient_data'
      ? state.insufficientReasons
      : [],
  }
}
