/**
 * KAN-789/T4 — Server-owned limits for temporary SQL review snapshots.
 * This module validates capacity only; authentication and SQL lifecycle belong
 * to their respective authorized boundaries.
 */
export const SESSION_GENERATION_SNAPSHOT_LIMITS = Object.freeze({
  ttlMinutes: 30,
  maxActivePerOwnerPlan: 2,
  maxBytes: 4 * 1024 * 1024,
  maxSessions: 500,
  maxMicrocycles: 60,
  maxPrescriptions: 500,
  maxExplanationStages: 9,
  maxFactsPerExplanationStage: 256,
})

type SnapshotEnvelope = {
  proposal: unknown
  generationExplanations: unknown
  sourceManifest: unknown
  sessionCount: number
  microcycleCount: number
}

function assertSerializable(value: unknown): string {
  const seen = new Set<object>()

  function visit(item: unknown): void {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return
    if (typeof item === 'number') {
      if (Number.isFinite(item)) return
      throw new Error('Snapshot payload contains non-finite numbers')
    }
    if (typeof item !== 'object') {
      throw new Error('Snapshot payload contains unserializable values')
    }
    if (seen.has(item)) {
      throw new Error('Snapshot payload contains circular or shared object references')
    }
    seen.add(item)
    if (Array.isArray(item)) {
      for (const entry of item) visit(entry)
    } else {
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
        throw new Error('Snapshot payload must contain plain JSON objects')
      }
      for (const key of Object.keys(item)) visit((item as Record<string, unknown>)[key])
    }
    seen.delete(item)
  }

  visit(value)
  const serialized = JSON.stringify(value)
  if (typeof serialized !== 'string') throw new Error('Snapshot payload is not serializable')
  return serialized
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Capacity checks only: full proposal/scope semantics belong to the T5 boundary. */
function assertBoundedComplexity(envelope: SnapshotEnvelope): void {
  const proposal = envelope.proposal
  if (isObject(proposal) && Array.isArray(proposal.events)) {
    let prescriptions = 0
    for (const event of proposal.events) {
      if (!isObject(event) || !Array.isArray(event.prescriptions)) {
        throw new Error('Snapshot prescriptions structure is invalid')
      }
      prescriptions += event.prescriptions.length
      if (prescriptions > SESSION_GENERATION_SNAPSHOT_LIMITS.maxPrescriptions) {
        throw new Error('Snapshot prescriptions complexity limit exceeded')
      }
    }
  }

  const explanations = envelope.generationExplanations
  if (isObject(explanations)) {
    for (const explanation of Object.values(explanations)) {
      if (!isObject(explanation) || !('stages' in explanation)) continue
      if (!Array.isArray(explanation.stages)) {
        throw new Error('Snapshot explanation stages structure is invalid')
      }
      if (explanation.stages.length > SESSION_GENERATION_SNAPSHOT_LIMITS.maxExplanationStages) {
        throw new Error('Snapshot explanation stages limit exceeded')
      }
      for (const stage of explanation.stages) {
        if (!isObject(stage)) throw new Error('Snapshot explanation stage is invalid')
        let facts = 0
        for (const key of ['inputs', 'constraints', 'decision', 'consequence']) {
          const value = stage[key]
          if (value !== undefined && !Array.isArray(value)) {
            throw new Error('Snapshot explanation facts structure is invalid')
          }
          facts += Array.isArray(value) ? value.length : 0
        }
        if (stage.warnings !== undefined) {
          if (!Array.isArray(stage.warnings)) {
            throw new Error('Snapshot explanation warnings structure is invalid')
          }
          for (const warning of stage.warnings) {
            if (!isObject(warning) || !Array.isArray(warning.facts)) {
              throw new Error('Snapshot explanation warning facts structure is invalid')
            }
            facts += warning.facts.length
          }
        }
        if (facts > SESSION_GENERATION_SNAPSHOT_LIMITS.maxFactsPerExplanationStage) {
          throw new Error('Snapshot explanation facts complexity limit exceeded')
        }
      }
    }
  }
}

/** Validate before allocating an authorized snapshot, never accept client counts as authority. */
export function validateSessionGenerationSnapshotEnvelope(envelope: SnapshotEnvelope): number {
  const { sessionCount, microcycleCount } = envelope
  if (!Number.isSafeInteger(sessionCount) || sessionCount < 0 ||
    sessionCount > SESSION_GENERATION_SNAPSHOT_LIMITS.maxSessions) {
    throw new Error('Snapshot sessions limit exceeded or invalid')
  }
  if (!Number.isSafeInteger(microcycleCount) || microcycleCount < 0 ||
    microcycleCount > SESSION_GENERATION_SNAPSHOT_LIMITS.maxMicrocycles) {
    throw new Error('Snapshot microcycles limit exceeded or invalid')
  }

  assertBoundedComplexity(envelope)

  const json = assertSerializable({
    proposal: envelope.proposal,
    generationExplanations: envelope.generationExplanations,
    sourceManifest: envelope.sourceManifest,
  })
  const bytes = Buffer.byteLength(json, 'utf8')
  if (bytes > SESSION_GENERATION_SNAPSHOT_LIMITS.maxBytes) {
    throw new Error('Snapshot size limit exceeded in bytes')
  }
  return bytes
}
