import { readVerticalBlockJson } from './vertical-prescription-json'
import type { VerticalPrimaryObjective } from './vertical-prescription'

/**
 * Read-only representation of persisted vertical fields.
 * A future or malformed payload is never interpreted as supported v1.
 * Raw bytes remain available for explicit compatibility/diagnostics only.
 */
export function projectVerticalPrescriptionRead(input: {
  primaryObjective: VerticalPrimaryObjective | null
  verticalBlockJson: string | null
}) {
  return {
    primaryObjective: input.primaryObjective,
    verticalBlockJson: input.verticalBlockJson,
    verticalBlock: readVerticalBlockJson(input.verticalBlockJson),
  }
}
