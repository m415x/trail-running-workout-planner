import { writeVerticalBlockJson } from './vertical-prescription-json'
import {
  resolveVerticalPrimaryObjective,
  type VerticalBlockV1,
  type VerticalPrimaryObjective,
} from './vertical-prescription'

export interface ExistingVerticalPrescriptionFields {
  primaryObjective: string | null
  verticalBlockJson: string | null
}

export interface VerticalPrescriptionEditFieldsInput {
  previous: ExistingVerticalPrescriptionFields | null
  /** Undefined means the existing objective must survive a legacy-only edit. */
  primaryObjective?: VerticalPrimaryObjective | null
  /** Undefined means preserve the original JSON bytes, including future schemas. */
  verticalBlock?: VerticalBlockV1 | null
}

/**
 * Resolve vertical fields for an existing Session + microcycle prescription.
 *
 * Omitting either field preserves its original persisted representation,
 * including unknown future versions or corrupt data without rewriting them.
 * An explicit null clears the corresponding field. A supplied v1 block must
 * pass the same strict serializer and 4096-byte limit as a new prescription.
 *
 * This resolver only handles field preservation. The caller must independently
 * authorize Session/Plan/Team, validate complete/partial D+ against the final
 * session dose, and commit the write and audit in one transaction.
 */
export function resolveVerticalPrescriptionEditFields(
  input: VerticalPrescriptionEditFieldsInput,
): ExistingVerticalPrescriptionFields {
  const prior = input.previous
  const primaryObjective = input.primaryObjective === undefined
    ? prior?.primaryObjective ?? null
    : resolveVerticalPrimaryObjective({ primaryObjective: input.primaryObjective })

  const verticalBlockJson = input.verticalBlock === undefined
    ? prior?.verticalBlockJson ?? null
    : writeVerticalBlockJson(input.verticalBlock)

  return { primaryObjective, verticalBlockJson }
}
