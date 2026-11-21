import type { VerticalBlockV1 } from './vertical-prescription'

interface VerticalTrackReferenceScope {
  groupId: string
  trackReference: string
}

interface VerticalTrackReferencePrescription {
  groupId: string
  verticalBlock?: VerticalBlockV1 | null
}

/**
 * A supplied trackReference is an untrusted locator, never an authorization.
 * Check both independent metric provenances for every submitted Group scope.
 */
export async function assertAuthorizedVerticalTrackReferences(input: {
  prescriptions: readonly VerticalTrackReferencePrescription[]
  authorizeTrack(scope: VerticalTrackReferenceScope): Promise<boolean>
}): Promise<void> {
  const checked = new Set<string>()
  for (const prescription of input.prescriptions) {
    const block = prescription.verticalBlock
    if (!block) continue

    for (const metric of [block.elevationGainPerRep, block.elevationLossPerRep]) {
      if (metric.provenance.kind !== 'track_adopted') continue
      const trackReference = metric.provenance.trackReference
      const groupId = prescription.groupId
      if (!groupId.trim() || !trackReference.trim()) {
        throw new Error('Vertical track authorization denied: incomplete scope')
      }

      const key = JSON.stringify([groupId, trackReference])
      if (checked.has(key)) continue
      checked.add(key)
      if (!await input.authorizeTrack({ groupId, trackReference })) {
        throw new Error('Vertical track authorization denied')
      }
    }
  }
}

/**
 * Fail closed until the application owns a verified Team/Group-scoped track
 * registry. Never trust a client-supplied track path or opaque reference.
 */
export async function denyUnverifiableVerticalTrackReference(
  _scope: VerticalTrackReferenceScope,
): Promise<boolean> {
  return false
}
