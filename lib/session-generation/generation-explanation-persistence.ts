import {
  assertValidGenerationExplanation,
  type GenerationExplanation,
  type GenerationExplanationPlanningScope,
} from '@/lib/session-generation/generation-explanation'

export function parseGenerationExplanationSnapshots(
  raw: string,
): Map<string, GenerationExplanation> {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Generation explanation snapshots must be an object keyed by generation key')
  }

  const snapshots = new Map<string, GenerationExplanation>()
  for (const [generationKey, value] of Object.entries(parsed)) {
    const normalizedKey = generationKey.trim()
    if (!normalizedKey) {
      throw new RangeError('Generation explanation snapshot key cannot be empty')
    }

    const explanation = value as GenerationExplanation
    assertValidGenerationExplanation(explanation)
    snapshots.set(normalizedKey, explanation)
  }

  return snapshots
}

export function resolveGenerationExplanationSnapshot(input: {
  snapshots: Map<string, GenerationExplanation>
  generationKey: string
  expectedScope: GenerationExplanationPlanningScope
}): GenerationExplanation | null {
  const generationKey = input.generationKey.trim()
  if (!generationKey) {
    throw new RangeError('Generation key cannot be empty')
  }

  const explanation = input.snapshots.get(generationKey) ?? null
  if (!explanation) return null

  assertValidGenerationExplanation(explanation)
  if (!samePlanningScope(explanation.planningScope, input.expectedScope)) {
    throw new RangeError(
      `Generation explanation planning scope does not match generation key ${generationKey}`,
    )
  }

  return explanation
}

function samePlanningScope(
  left: GenerationExplanationPlanningScope,
  right: GenerationExplanationPlanningScope,
): boolean {
  return (
    left.kind === right.kind &&
    left.groupTrainingPlanId === right.groupTrainingPlanId &&
    left.groupId === right.groupId &&
    left.microcycleId === right.microcycleId &&
    left.planningCohortId === right.planningCohortId
  )
}
