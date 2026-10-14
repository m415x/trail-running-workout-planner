import { createHash } from 'node:crypto'

/**
 * KAN-790/T5.3 — deterministic fingerprint of generation inputs already
 * resolved by a trusted server boundary. Neither SQL sourcing nor fresh
 * authorization is supplied by this pure function.
 */
export interface ReviewGenerationInputManifest {
  readonly manifestVersion: 1
  readonly groupTrainingPlanId: string
  readonly generationInputCount: number
  readonly generationInputSha256: string
}

function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>()

  function serialize(item: unknown): string {
    if (item === null) return 'null'
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item)
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item)
    if (typeof item !== 'object') throw new Error('Invalid generation source input: not JSON-serializable')
    if (ancestors.has(item)) throw new Error('Invalid generation source input: cyclic reference')
    if (!Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null) {
      throw new Error('Invalid generation source input: expected a plain JSON object')
    }

    ancestors.add(item)
    try {
      if (Array.isArray(item)) {
        // The effective generation input order is significant.
        return '[' + item.map(serialize).join(',') + ']'
      }
      const object = item as Record<string, unknown>
      return '{' + Object.keys(object).sort().map(key =>
        JSON.stringify(key) + ':' + serialize(object[key]),
      ).join(',') + '}'
    } finally {
      ancestors.delete(item)
    }
  }

  return serialize(value)
}

export function buildReviewGenerationInputManifest(input: unknown): ReviewGenerationInputManifest {
  // This is a validation boundary: invalid callers must be rejectable at
  // runtime, including in negative tests, rather than excluded by TypeScript.
  if (input === null || Array.isArray(input) || typeof input !== 'object' ||
    !('groupTrainingPlanId' in input) ||
    typeof input.groupTrainingPlanId !== 'string' ||
    !input.groupTrainingPlanId.trim() ||
    !('generationInputs' in input) ||
    !Array.isArray(input.generationInputs) ||
    input.generationInputs.length === 0) {
    throw new Error('Invalid or empty generation source manifest input')
  }

  // Every input must belong to the single authorized Plan. A valid digest
  // cannot make mixed-Plan or repeated microcycle inputs authoritative.
  const seenMicrocycleIds = new Set<string>()
  for (const entry of input.generationInputs) {
    if (entry === null || Array.isArray(entry) || typeof entry !== 'object' ||
      !('context' in entry) || entry.context === null ||
      typeof entry.context !== 'object' || Array.isArray(entry.context)) {
      throw new Error('Invalid generation source input: missing generation context')
    }
    const context = entry.context
    if (!('groupTrainingPlanId' in context) ||
      context.groupTrainingPlanId !== input.groupTrainingPlanId) {
      throw new Error('Generation source input Plan scope mismatch')
    }
    if (!('microcycleId' in context) ||
      typeof context.microcycleId !== 'string' || !context.microcycleId.trim()) {
      throw new Error('Invalid generation source microcycle identity')
    }
    if (seenMicrocycleIds.has(context.microcycleId)) {
      throw new Error('Duplicate generation source microcycle identity')
    }
    seenMicrocycleIds.add(context.microcycleId)
  }

  const canonical = canonicalJson(input.generationInputs)
  return {
    manifestVersion: 1,
    groupTrainingPlanId: input.groupTrainingPlanId,
    generationInputCount: input.generationInputs.length,
    generationInputSha256: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  }
}
