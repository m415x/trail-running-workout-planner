import type { EventEmitter } from 'node:events'

import {
  buildAcceptanceDevCtrlcProbeRunPlan,
  type AcceptanceDevCtrlcProbeRunPlan,
  type AcceptanceDevCtrlcProbeRunPlanInput,
} from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'

export interface AcceptanceDevCtrlcProbeOwnedRunInput extends AcceptanceDevCtrlcProbeRunPlanInput {
  signalSource: EventEmitter
  runOwnedWorker: (
    plan: AcceptanceDevCtrlcProbeRunPlan,
    signalSource: EventEmitter,
  ) => Promise<number>
}

/**
 * KAN-885/T3 L6: dependency-injected composition only.
 *
 * The validated, allowlisted test-only plan is passed to one owned lifecycle
 * adapter. This function neither spawns a worker nor wires the interactive
 * CLI. Real Ctrl+C, ownership and cleanup still require accreditation.
 */
export async function runAcceptanceDevCtrlcProbeOwnedWorker(
  input: AcceptanceDevCtrlcProbeOwnedRunInput,
): Promise<number> {
  const plan = buildAcceptanceDevCtrlcProbeRunPlan({
    projectRoot: input.projectRoot,
    statePath: input.statePath,
    nonce: input.nonce,
    inheritedEnv: input.inheritedEnv,
  })

  try {
    const exitCode = await input.runOwnedWorker(plan, input.signalSource)
    if (!Number.isSafeInteger(exitCode) || exitCode < 0) {
      throw new Error('KAN-885: invalid disposable worker exit status')
    }
    return exitCode
  } catch (error) {
    if (error instanceof Error && /^KAN-885:.*interrupt/i.test(error.message)) {
      throw new Error('KAN-885: owned disposable worker interrupted')
    }
    throw new Error('KAN-885: owned disposable worker execution failed')
  }
}
