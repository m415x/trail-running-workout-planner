import type { VerticalBlockV1 } from './vertical-prescription'
import { readVerticalBlockJson } from './vertical-prescription-json'

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
  // The scope is intentionally ignored until a trusted registry exists.
  void _scope
  return false
}

/**
 * Authorize the effective v1 provenance written by an edit, not only submitted
 * fields. Omission retains the active prescription's original JSON. Explicit
 * replacement or clear supersedes that prior value.
 *
 * Opaque unsupported/corrupt JSON is not interpreted as a v1 track; separate
 * consistency guards retain or reject those records according to edit scope.
 */
export async function assertAuthorizedEffectiveVerticalTrackReferences(input: {
  prescriptions: readonly (VerticalTrackReferencePrescription & {
    microcycleId: string
  })[]
  previous: readonly { microcycleId: string; verticalBlockJson: string | null }[]
  authorizeTrack(scope: VerticalTrackReferenceScope): Promise<boolean>
}): Promise<void> {
  const previousByMicrocycle = new Map(input.previous.map(row => [row.microcycleId, row]))
  const effective: VerticalTrackReferencePrescription[] = input.prescriptions.map(prescription => {
    if (prescription.verticalBlock !== undefined) {
      return { groupId: prescription.groupId, verticalBlock: prescription.verticalBlock }
    }

    const raw = previousByMicrocycle.get(prescription.microcycleId)?.verticalBlockJson ?? null
    const read = readVerticalBlockJson(raw)
    return {
      groupId: prescription.groupId,
      verticalBlock: read.status === 'valid' ? read.block : null,
    }
  })

  await assertAuthorizedVerticalTrackReferences({
    prescriptions: effective,
    authorizeTrack: input.authorizeTrack,
  })
}
