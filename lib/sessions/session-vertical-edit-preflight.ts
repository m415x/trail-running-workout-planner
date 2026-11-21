import {
  assertVerticalEditElevationConsistency,
  resolveVerticalPrescriptionEditFields,
  type ExistingVerticalPrescriptionFields,
} from './session-vertical-edit-fields'
import type { VerticalBlockV1, VerticalPrimaryObjective } from './vertical-prescription'

export interface PreviousVerticalSessionEdit extends ExistingVerticalPrescriptionFields {
  microcycleId: string
  elevationGain: number | null
}

export interface SubmittedVerticalSessionEdit {
  microcycleId: string
  elevationGain: number | null
  primaryObjective?: VerticalPrimaryObjective | null
  verticalBlock?: VerticalBlockV1 | null
}

/**
 * Validates all effective vertical doses before the authorized transaction
 * makes any Session, prescription or audit write. The caller is responsible
 * for H2/H3/H4A and the Session/Team/Plan ownership boundary.
 *
 * Each row is scoped to its unique Session + microcycle; no scope fallback.
 * The edit resolver preserves opaque bytes for omitted fields, while the D+
 * guard rejects changes that could contradict unrecognized data.
 */
export function preflightVerticalSessionEdits(input: {
  previous: readonly PreviousVerticalSessionEdit[]
  edits: readonly SubmittedVerticalSessionEdit[]
}): void {
  const previousByMicrocycle = new Map(
    input.previous.map(row => [row.microcycleId, row]),
  )
  const seen = new Set<string>()
  for (const prescription of input.edits) {
    if (!prescription.microcycleId.trim() || seen.has(prescription.microcycleId)) {
      throw new RangeError('Duplicate or missing vertical microcycle scope')
    }
    seen.add(prescription.microcycleId)

    const previousPrescription = previousByMicrocycle.get(prescription.microcycleId)
    const verticalFields = resolveVerticalPrescriptionEditFields({
      previous: previousPrescription ?? null,
      primaryObjective: prescription.primaryObjective,
      verticalBlock: prescription.verticalBlock,
    })
    assertVerticalEditElevationConsistency({
      previousElevationGain: previousPrescription?.elevationGain ?? null,
      nextElevationGain: prescription.elevationGain,
      verticalBlockJson: verticalFields.verticalBlockJson,
      verticalBlockExplicitlyChanged: prescription.verticalBlock !== undefined,
    })
  }
}
