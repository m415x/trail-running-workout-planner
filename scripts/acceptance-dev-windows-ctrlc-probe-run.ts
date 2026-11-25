import type { EventEmitter } from 'node:events'

import {
  runAcceptanceDevWindowsManagedChild,
  type AcceptanceDevWindowsManagedSpawnOptions,
} from '@/scripts/acceptance-dev-child-env'

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

export interface AcceptanceDevCtrlcProbeWindowsManagedWorkerInput {
  plan: AcceptanceDevCtrlcProbeRunPlan
  signalSource: EventEmitter
  launcherPid: number
  spawnProcess: (
    command: string,
    args: string[],
    options: AcceptanceDevWindowsManagedSpawnOptions,
  ) => EventEmitter & { pid?: number }
  terminationTimeoutMs?: number
}

/**
 * KAN-885/T3 L6: connect the test-only worker plan to the existing,
 * dependency-injected Windows owned-child lifecycle. The launched process PID
 * comes only from spawnProcess's returned handle. SIGINT/SIGTERM tree
 * termination and listener disposal are delegated to that audited boundary.
 *
 * This adapter does not spawn itself or enable the interactive --run CLI.
 */
export function runAcceptanceDevCtrlcProbeWindowsManagedWorker(
  input: AcceptanceDevCtrlcProbeWindowsManagedWorkerInput,
): Promise<number> {
  return runAcceptanceDevWindowsManagedChild({
    plan: input.plan,
    signalSource: input.signalSource,
    launcherPid: input.launcherPid,
    spawnProcess: input.spawnProcess,
    terminationTimeoutMs: input.terminationTimeoutMs,
  })
}
