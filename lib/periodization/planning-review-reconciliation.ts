import {
  buildPlanningReviewDecisionBlocks,
  validatePlanningReviewBlockSelection,
} from '@/lib/periodization/planning-review-blocks'
import { buildIntegralPlanningDiff } from '@/lib/periodization/planning-review-diff'
import type {
  PlanningReviewBlockDecision,
  PlanningReviewDecisionBlock,
} from '@/types/training/planning-review-block.types'
import type {
  IntegralPlanningDiffItem,
  IntegralPlanningDiffOperation,
} from '@/types/training/planning-review-diff.types'
import type {
  IntegralPlanningReview,
  PlanningReviewScope,
} from '@/types/training/planning-review.types'
import type {
  IntegralPlanningReconciliation,
  PlanningReviewReconciliationRange,
  PlanningReviewScopedOperation,
  ReconcileAcceptedPlanningBlocksInput,
} from '@/types/training/planning-review-reconciliation.types'

type WriteOperation = Exclude<IntegralPlanningDiffOperation, 'none'>
type WriteItem = IntegralPlanningDiffItem & { readonly operation: WriteOperation }

function sameScope(first: PlanningReviewScope, second: PlanningReviewScope) {
  return first.teamId === second.teamId
    && first.groupId === second.groupId
    && first.groupTrainingPlanId === second.groupTrainingPlanId
    && first.kind === second.kind
    && first.planningCohortId === second.planningCohortId
    && first.sourceGroupTrainingPlanId === second.sourceGroupTrainingPlanId
}

function hasWriteOperation(item: IntegralPlanningDiffItem): item is WriteItem {
  return item.operation !== 'none'
}

function planRange(review: IntegralPlanningReview) {
  if (review.macrocycles.length === 0) return null
  const starts = review.macrocycles.map(({ macrocycle }) => macrocycle.startDate).sort()
  const ends = review.macrocycles.map(({ macrocycle }) => macrocycle.endDate).sort()
  return { startDate: starts[0], endDate: ends[ends.length - 1] }
}

function macrocycleRange(
  review: IntegralPlanningReview,
  macrocycleId: string,
) {
  const node = review.macrocycles.find(({ macrocycle }) => macrocycle.id === macrocycleId)
  return node === undefined
    ? null
    : {
        startDate: node.macrocycle.startDate,
        endDate: node.macrocycle.endDate,
      }
}

function competitionRange(
  review: IntegralPlanningReview,
  competitionId: string,
) {
  const competition = review.competitions.find(({ entry }) => entry.id === competitionId)
  return competition === undefined
    ? null
    : { startDate: competition.entry.date, endDate: competition.entry.date }
}

function rangeForBlock(
  block: PlanningReviewDecisionBlock,
  current: IntegralPlanningReview,
  proposed: IntegralPlanningReview,
): PlanningReviewReconciliationRange | null {
  if (block.kind === 'plan') {
    return planRange(proposed) ?? planRange(current)
  }
  if (block.kind === 'macrocycle') {
    return macrocycleRange(proposed, block.root.entityId)
      ?? macrocycleRange(current, block.root.entityId)
  }
  if (block.kind === 'competition') {
    return competitionRange(proposed, block.root.entityId)
      ?? competitionRange(current, block.root.entityId)
  }
  return null
}

function operationFor(
  item: WriteItem,
  block: PlanningReviewDecisionBlock,
  decision: PlanningReviewBlockDecision,
): PlanningReviewScopedOperation {
  return {
    identity: item.identity,
    parentIdentity: item.parentIdentity,
    entity: item.entity,
    operation: item.operation,
    changes: item.changes,
    blockId: block.id,
    decisionProvenance: decision.provenance,
  }
}

function isPlanningOperation({ entity }: PlanningReviewScopedOperation) {
  return entity.entityType === 'plan'
    || entity.entityType === 'macrocycle'
    || entity.entityType === 'mesocycle'
    || entity.entityType === 'microcycle'
}

/**
 * Rebuilds the reviewed diff and emits the exact persistence-ready write set
 * selected by the coach. It deliberately performs no database mutation.
 *
 * Unlike whole-macrocycle regeneration, unchanged descendants never appear in
 * the result. Group/cohort scope and coach provenance travel with every write.
 */
export function reconcileAcceptedPlanningBlocks({
  current,
  proposed,
  decisions,
}: ReconcileAcceptedPlanningBlocksInput): IntegralPlanningReconciliation {
  if (!sameScope(current.scope, proposed.scope)) {
    throw new Error('Current and proposed reviews must have the same group/cohort scope')
  }

  const diff = buildIntegralPlanningDiff(current, proposed)
  const review = buildPlanningReviewDecisionBlocks(diff)
  const selection = validatePlanningReviewBlockSelection(review, decisions)

  if (!selection.isValid) {
    const codes = selection.issues.map(({ code }) => code).join(', ')
    throw new Error(`Invalid planning block selection: ${codes}`)
  }

  const decisionsByBlock = new Map(
    selection.decisions.map((decision) => [decision.blockId, decision]),
  )
  const acceptedIdentitySet = new Set(selection.acceptedItemIdentities)
  const blocks = review.blocks
    .filter(({ id }) => selection.acceptedBlockIds.includes(id))
    .map((block) => {
      const decision = decisionsByBlock.get(block.id)
      if (decision === undefined || decision.decision !== 'accept') {
        throw new Error(`Accepted block ${block.id} has no accepted coach decision`)
      }
      const items = block.items
        .filter(hasWriteOperation)
        .filter(({ identity }) => acceptedIdentitySet.has(identity))
      return {
        block,
        decision,
        items,
      }
    })

  const operations = blocks
    .flatMap(({ block, decision, items }) => (
      items.map((item) => operationFor(item, block, decision))
    ))
    .sort((first, second) => first.identity.localeCompare(second.identity))

  return {
    scope: proposed.scope,
    blocks: blocks.map(({ block, decision, items }) => ({
      blockId: block.id,
      root: block.root,
      range: rangeForBlock(block, current, proposed),
      operationIdentities: items.map(({ identity }) => identity).sort(),
      decisionProvenance: decision.provenance,
    })),
    operations,
    planningOperations: operations.filter(isPlanningOperation),
    sessionOperations: operations.filter(({ entity }) => entity.entityType === 'session'),
    prescriptionOperations: operations.filter(
      ({ entity }) => entity.entityType === 'prescription',
    ),
    competitionOperations: operations.filter(
      ({ entity }) => entity.entityType === 'competition',
    ),
    acceptedItemIdentities: selection.acceptedItemIdentities,
    rejectedBlockIds: selection.rejectedBlockIds,
    pendingBlockIds: selection.pendingBlockIds,
    coachDecisions: selection.decisions,
  }
}
