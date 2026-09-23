import type { ReferencePercentage } from '@/types/training/intensity.types'

export type LegacyPercentageScale = 'percent' | 'fraction' | 'unknown'

export type LegacyPercentageClassification =
  | { status: 'resolved'; referencePercentage: ReferencePercentage }
  | { status: 'ambiguous'; originalValue: number }

/**
 * Resolve legacy values only when their scale is explicitly documented.
 * Magnitude alone cannot establish whether a historical value is a percent
 * or a fractional multiplier.
 */
export function classifyLegacyPercentage(input: {
  value: number
  scale: LegacyPercentageScale
}): LegacyPercentageClassification {
  if (input.scale === 'unknown') {
    return { status: 'ambiguous', originalValue: input.value }
  }

  return {
    status: 'resolved',
    referencePercentage: input.scale === 'fraction' ? input.value * 100 : input.value,
  }
}
