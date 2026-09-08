import type {
  SessionGenerationProposal,
  SessionGenerationResult,
  SharedSessionEventProposal,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'

/**
 * Consolidates compatible group proposals into shared Session candidates.
 *
 * Only the event is reused. Distance, D+, intensity, microcycle and notes stay
 * in independent group prescriptions. A shared key with different event data
 * is rejected because silently choosing either payload would corrupt intent.
 */
export function groupSharedSessionEvents(
  results: SessionGenerationResult[],
): SharedSessionGenerationResult {
  const eventsByKey = new Map<string, SharedSessionEventProposal>()
  const generationKeys = new Set<string>()

  for (const result of results) {
    for (const proposal of result.proposals) {
      assertUniqueGenerationKey(proposal, generationKeys)
      const existing = eventsByKey.get(proposal.sharedEventKey)

      if (!existing) {
        eventsByKey.set(proposal.sharedEventKey, createSharedEvent(proposal))
        continue
      }

      if (!sameEvent(existing.session, proposal.session)) {
        throw new RangeError(
          `Shared event key ${proposal.sharedEventKey} contains incompatible session values`,
        )
      }
      if (existing.prescriptions.some(({ prescription }) => (
        prescription.groupId === proposal.prescription.groupId
      ))) {
        throw new RangeError(
          `Shared event key ${proposal.sharedEventKey} contains duplicate group ${proposal.prescription.groupId}`,
        )
      }

      existing.prescriptions.push(toSharedPrescription(proposal))
      existing.prescriptions.sort((left, right) => (
        left.prescription.groupId.localeCompare(right.prescription.groupId) ||
        left.generationKey.localeCompare(right.generationKey)
      ))
      existing.warnings = uniqueWarnings([...existing.warnings, ...proposal.warnings])
    }
  }

  const events = [...eventsByKey.values()].sort((left, right) => (
    left.session.date.localeCompare(right.session.date) ||
    left.sharedEventKey.localeCompare(right.sharedEventKey)
  ))
  const warnings = uniqueWarnings([
    ...results.flatMap((result) => result.warnings),
    ...events.flatMap((event) => event.warnings),
  ])

  return { events, warnings }
}

function createSharedEvent(proposal: SessionGenerationProposal): SharedSessionEventProposal {
  return {
    sharedEventKey: proposal.sharedEventKey,
    session: cloneSession(proposal.session),
    prescriptions: [toSharedPrescription(proposal)],
    warnings: [...proposal.warnings],
  }
}

function toSharedPrescription(proposal: SessionGenerationProposal) {
  return {
    generationKey: proposal.generationKey,
    slotKey: proposal.slotKey,
    role: proposal.role,
    prescription: { ...proposal.prescription },
    warnings: [...proposal.warnings],
  }
}

function cloneSession(session: SessionGenerationProposal['session']) {
  return {
    ...session,
    structure: session.structure ? { ...session.structure } : null,
  }
}

function sameEvent(
  left: SessionGenerationProposal['session'],
  right: SessionGenerationProposal['session'],
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertUniqueGenerationKey(
  proposal: SessionGenerationProposal,
  generationKeys: Set<string>,
) {
  if (!proposal.generationKey.trim()) throw new RangeError('Generation key cannot be empty')
  if (!proposal.sharedEventKey.trim()) throw new RangeError('Shared event key cannot be empty')
  if (generationKeys.has(proposal.generationKey)) {
    throw new RangeError(`Duplicated generation key: ${proposal.generationKey}`)
  }
  generationKeys.add(proposal.generationKey)
}

function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings)]
}
