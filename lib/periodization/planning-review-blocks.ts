import type {
  IntegralPlanningBlockSelection,
  IntegralPlanningDecisionBlocks,
  PlanningReviewBlockDecision,
  PlanningReviewBlockDecisionIssue,
  PlanningReviewDecisionBlock,
  PlanningReviewDecisionBlockKind,
} from '@/types/training/planning-review-block.types'
import type {
  IntegralPlanningDiff,
  IntegralPlanningDiffItem,
} from '@/types/training/planning-review-diff.types'
import type {
  PlanningReviewIssue,
  PlanningReviewIssueReference,
} from '@/types/training/planning-review.types'

interface MutableBlock {
  readonly id: string
  readonly kind: PlanningReviewDecisionBlockKind
  readonly root: PlanningReviewIssueReference
  readonly items: IntegralPlanningDiffItem[]
}

function rootFor(
  item: IntegralPlanningDiffItem,
  itemsByIdentity: ReadonlyMap<string, IntegralPlanningDiffItem>,
) {
  if (item.entity.entityType === 'plan') {
    return {
      id: `plan:${item.identity}`,
      kind: 'plan' as const,
      root: item.entity,
    }
  }
  if (item.entity.entityType === 'competition') {
    return {
      id: `competition:${item.identity}`,
      kind: 'competition' as const,
      root: item.entity,
    }
  }

  let current: IntegralPlanningDiffItem | undefined = item
  const visited = new Set<string>()
  while (current !== undefined && !visited.has(current.identity)) {
    visited.add(current.identity)
    if (current.entity.entityType === 'macrocycle') {
      return {
        id: `macrocycle:${current.identity}`,
        kind: 'macrocycle' as const,
        root: current.entity,
      }
    }
    current = current.parentIdentity === null
      ? undefined
      : itemsByIdentity.get(current.parentIdentity)
  }

  return {
    id: 'unscoped:planning',
    kind: 'unscoped' as const,
    root: item.entity,
  }
}

function issueTouchesBlock(
  issue: PlanningReviewIssue,
  block: MutableBlock,
) {
  return issue.references.some((reference) => block.items.some(({ entity }) => (
    entity.entityType === reference.entityType
    && entity.entityId === reference.entityId
  )))
}

function dependencyIds(
  block: MutableBlock,
  planBlockId: string | undefined,
) {
  if (
    planBlockId === undefined
    || block.id === planBlockId
    || block.kind === 'unscoped'
  ) {
    return []
  }
  return [planBlockId]
}

/**
 * Groups one integral diff into independently reviewable, referentially coherent
 * units. A macrocycle block owns its complete descendant subtree, so sessions
 * and prescriptions cannot be accepted without their planning hierarchy.
 */
export function buildPlanningReviewDecisionBlocks(
  diff: IntegralPlanningDiff,
): IntegralPlanningDecisionBlocks {
  const itemsByIdentity = new Map(diff.items.map((item) => [item.identity, item]))
  const changedItems = diff.items.filter(({ classification }) => (
    classification !== 'preserved'
  ))
  const mutableBlocks = new Map<string, MutableBlock>()

  for (const item of changedItems) {
    const root = rootFor(item, itemsByIdentity)
    const block = mutableBlocks.get(root.id)
    if (block === undefined) {
      mutableBlocks.set(root.id, { ...root, items: [item] })
    } else {
      block.items.push(item)
    }
  }

  const planBlockId = [...mutableBlocks.values()]
    .find(({ kind }) => kind === 'plan')?.id

  const unmatchedConflicts = diff.issues.filter((issue) => (
    issue.severity === 'conflict'
    && ![...mutableBlocks.values()].some((block) => issueTouchesBlock(issue, block))
  ))

  const blocks: PlanningReviewDecisionBlock[] = [...mutableBlocks.values()]
    .map((block) => {
      const blockIssues = [
        ...diff.issues.filter((issue) => issueTouchesBlock(issue, block)),
        ...unmatchedConflicts,
      ]
      const items = [...block.items].sort((first, second) => (
        first.identity.localeCompare(second.identity)
      ))
      return {
        id: block.id,
        kind: block.kind,
        root: block.root,
        itemIdentities: items.map(({ identity }) => identity),
        items,
        dependencyBlockIds: dependencyIds(block, planBlockId),
        issues: blockIssues,
        canAccept: block.kind !== 'unscoped'
          && items.every(({ classification }) => classification !== 'conflict')
          && blockIssues.every(({ severity }) => severity !== 'conflict'),
      }
    })
    .sort((first, second) => first.id.localeCompare(second.id))

  return {
    blocks,
    issues: diff.issues,
    hasBlockingConflicts: blocks.some(({ canAccept }) => !canAccept),
  }
}

/**
 * Validates coach decisions without persisting them. Accepted blocks must be
 * conflict-free and every declared dependency must also be explicitly accepted.
 */
export function validatePlanningReviewBlockSelection(
  review: IntegralPlanningDecisionBlocks,
  decisions: readonly PlanningReviewBlockDecision[],
): IntegralPlanningBlockSelection {
  const blocksById = new Map(review.blocks.map((block) => [block.id, block]))
  const decisionsByBlock = new Map<string, PlanningReviewBlockDecision>()
  const issues: PlanningReviewBlockDecisionIssue[] = []

  for (const decision of decisions) {
    if (decisionsByBlock.has(decision.blockId)) {
      issues.push({
        code: 'duplicate_decision',
        blockId: decision.blockId,
        message: `Block ${decision.blockId} has more than one coach decision.`,
      })
      continue
    }
    decisionsByBlock.set(decision.blockId, decision)

    if (!blocksById.has(decision.blockId)) {
      issues.push({
        code: 'unknown_block',
        blockId: decision.blockId,
        message: `Block ${decision.blockId} does not belong to this review.`,
      })
    }
  }

  for (const decision of decisionsByBlock.values()) {
    const block = blocksById.get(decision.blockId)
    if (block === undefined || decision.decision === 'reject') continue

    if (!block.canAccept) {
      issues.push({
        code: 'conflicted_block_accepted',
        blockId: block.id,
        message: `Block ${block.id} contains a blocking conflict.`,
      })
    }

    for (const dependencyBlockId of block.dependencyBlockIds) {
      if (decisionsByBlock.get(dependencyBlockId)?.decision !== 'accept') {
        issues.push({
          code: 'dependency_not_accepted',
          blockId: block.id,
          dependencyBlockId,
          message: `Block ${block.id} requires accepted block ${dependencyBlockId}.`,
        })
      }
    }
  }

  const acceptedBlockIds = review.blocks
    .filter(({ id }) => decisionsByBlock.get(id)?.decision === 'accept')
    .map(({ id }) => id)
  const rejectedBlockIds = review.blocks
    .filter(({ id }) => decisionsByBlock.get(id)?.decision === 'reject')
    .map(({ id }) => id)
  const pendingBlockIds = review.blocks
    .filter(({ id }) => !decisionsByBlock.has(id))
    .map(({ id }) => id)
  const acceptedItemIdentities = review.blocks
    .filter(({ id }) => acceptedBlockIds.includes(id))
    .flatMap(({ items }) => items)
    .filter(({ operation }) => operation !== 'none')
    .map(({ identity }) => identity)
    .sort()

  return {
    isValid: issues.length === 0,
    acceptedBlockIds,
    rejectedBlockIds,
    pendingBlockIds,
    acceptedItemIdentities,
    decisions: [...decisionsByBlock.values()],
    issues,
  }
}
