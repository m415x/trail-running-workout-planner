import { canRegenerationReplace } from '@/lib/session-generation/generation-ownership'
import type {
  SessionEventGenerationProvenance,
  SessionGenerationOwnership,
  SessionPrescriptionGenerationProvenance,
  SharedEventPrescriptionProposal,
  SharedSessionEventProposal,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'

export interface ExistingGeneratedSessionEvent {
  id: string
  provenance: SessionEventGenerationProvenance
}

export interface ExistingGeneratedSessionPrescription {
  id: string
  sessionId: string
  provenance: SessionPrescriptionGenerationProvenance
}

export interface SessionRegenerationOperation<T> {
  action: 'create' | 'replace'
  existingId: string | null
  proposal: T
}

export interface ProtectedGenerationCollision {
  kind: 'event' | 'prescription'
  existingId: string
  generationKey: string
}

export interface SessionRegenerationPlan {
  events: SessionRegenerationOperation<SharedSessionEventProposal>[]
  prescriptions: SessionRegenerationOperation<SharedEventPrescriptionProposal>[]
  obsoleteEventIds: string[]
  obsoletePrescriptionIds: string[]
  protectedCollisions: ProtectedGenerationCollision[]
}

export interface ReconcileSessionGenerationParams {
  proposal: SharedSessionGenerationResult
  /** Existing records must already be scoped to the plan being regenerated. */
  existingEvents: ExistingGeneratedSessionEvent[]
  /** Existing records must already be scoped to the plan being regenerated. */
  existingPrescriptions: ExistingGeneratedSessionPrescription[]
}

/**
 * Builds an idempotent regeneration plan without writing to persistence.
 * Stable generation keys update records in place and prevent duplicate events
 * or group prescriptions across repeated runs.
 */
export function reconcileSessionGeneration({
  proposal,
  existingEvents,
  existingPrescriptions,
}: ReconcileSessionGenerationParams): SessionRegenerationPlan {
  const proposedEvents = indexProposedEvents(proposal.events)
  const proposedPrescriptions = indexProposedPrescriptions(proposal.events)
  const persistedEvents = indexExistingEvents(existingEvents)
  const persistedPrescriptions = indexExistingPrescriptions(existingPrescriptions)

  const events: SessionRegenerationPlan['events'] = []
  const prescriptions: SessionRegenerationPlan['prescriptions'] = []
  const protectedCollisions: ProtectedGenerationCollision[] = []

  for (const [sharedEventKey, event] of proposedEvents) {
    const existing = persistedEvents.get(sharedEventKey)
    if (!existing) {
      events.push({ action: 'create', existingId: null, proposal: event })
    } else if (canRegenerationReplace(existing.provenance.ownership)) {
      events.push({ action: 'replace', existingId: existing.id, proposal: event })
    } else {
      protectedCollisions.push({
        kind: 'event', existingId: existing.id, generationKey: sharedEventKey,
      })
    }
  }

  for (const [generationKey, prescription] of proposedPrescriptions) {
    const existing = persistedPrescriptions.get(generationKey)
    if (!existing) {
      prescriptions.push({ action: 'create', existingId: null, proposal: prescription })
    } else if (canRegenerationReplace(existing.provenance.ownership)) {
      prescriptions.push({ action: 'replace', existingId: existing.id, proposal: prescription })
    } else {
      protectedCollisions.push({
        kind: 'prescription', existingId: existing.id, generationKey,
      })
    }
  }

  return {
    events,
    prescriptions,
    obsoleteEventIds: findObsoleteGeneratedIds(persistedEvents, proposedEvents),
    obsoletePrescriptionIds: findObsoleteGeneratedIds(persistedPrescriptions, proposedPrescriptions),
    protectedCollisions,
  }
}

function indexProposedEvents(events: SharedSessionEventProposal[]) {
  return indexByStableKey(events, ({ sharedEventKey }) => sharedEventKey, 'sharedEventKey')
}

function indexProposedPrescriptions(events: SharedSessionEventProposal[]) {
  return indexByStableKey(
    events.flatMap(({ prescriptions }) => prescriptions),
    ({ generationKey }) => generationKey,
    'generationKey',
  )
}

function indexExistingEvents(events: ExistingGeneratedSessionEvent[]) {
  const generated = events.filter((event) => event.provenance.sharedEventKey !== null)
  return indexByStableKey(generated, (event) => event.provenance.sharedEventKey!, 'sharedEventKey')
}

function indexExistingPrescriptions(prescriptions: ExistingGeneratedSessionPrescription[]) {
  const generated = prescriptions.filter((item) => item.provenance.generationKey !== null)
  return indexByStableKey(generated, (item) => item.provenance.generationKey!, 'generationKey')
}

function indexByStableKey<T>(items: T[], readKey: (item: T) => string, field: string): Map<string, T> {
  const indexed = new Map<string, T>()
  for (const item of items) {
    const key = readKey(item).trim()
    if (!key) throw new RangeError(`${field} cannot be empty`)
    if (indexed.has(key)) throw new RangeError(`Duplicated ${field}: ${key}`)
    indexed.set(key, item)
  }
  return indexed
}

function findObsoleteGeneratedIds<
  TExisting extends { id: string; provenance: { ownership: SessionGenerationOwnership } },
>(
  existing: Map<string, TExisting>,
  proposed: Map<string, unknown>,
): string[] {
  return [...existing]
    .filter(([key, record]) => !proposed.has(key) && canRegenerationReplace(record.provenance.ownership))
    .map(([, record]) => record.id)
    .sort()
}
