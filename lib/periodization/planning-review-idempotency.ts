import { createHash } from 'node:crypto'

import type {
  IntegralPlanningReconciliation,
} from '@/types/training/planning-review-reconciliation.types'

function normalize(value: unknown): unknown {
  if (value === undefined) return { $undefined: true }
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, current]) => [key, normalize(current)]),
    )
  }
  return value
}

/**
 * Produces the semantic submission key stored by the atomic transaction port.
 * Projection arrays are sorted so caller ordering cannot create a second write.
 * Source/result revisions bind a replay to the exact reviewed state transition.
 */
export function integralPlanningIdempotencyKey(
  reconciliation: IntegralPlanningReconciliation,
) {
  const payload = {
    scope: reconciliation.scope,
    sourceRevisionKey: reconciliation.sourceRevisionKey,
    resultRevisionKey: reconciliation.resultRevisionKey,
    blocks: reconciliation.blocks
      .map((block) => ({
        ...block,
        operationIdentities: [...block.operationIdentities].sort(),
      }))
      .sort((first, second) => first.blockId.localeCompare(second.blockId)),
    operations: [...reconciliation.operations]
      .sort((first, second) => first.identity.localeCompare(second.identity)),
    rejectedBlockIds: [...reconciliation.rejectedBlockIds].sort(),
    pendingBlockIds: [...reconciliation.pendingBlockIds].sort(),
    coachDecisions: [...reconciliation.coachDecisions]
      .sort((first, second) => first.blockId.localeCompare(second.blockId)),
  }
  return createHash('sha256')
    .update(JSON.stringify(normalize(payload)))
    .digest('hex')
}
