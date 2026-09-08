import type {
  SessionEventGenerationProvenance,
  SessionGenerationOwnership,
  SessionPrescriptionGenerationProvenance,
} from '@/types/training/session-generation.types'

type GenerationProvenance =
  | SessionEventGenerationProvenance
  | SessionPrescriptionGenerationProvenance

/** Only untouched generated records may be replaced during regeneration. */
export function canRegenerationReplace(ownership: SessionGenerationOwnership): boolean {
  return ownership === 'generated'
}

/** Transfers an edited generated record to coach ownership without losing its origin. */
export function markAsManuallyModified<T extends GenerationProvenance>(provenance: T): T {
  if (provenance.ownership !== 'generated') return provenance

  return { ...provenance, ownership: 'generated_modified' }
}

/** Creates validated provenance for a generated shared event. */
export function generatedEventProvenance(sharedEventKey: string): SessionEventGenerationProvenance {
  return { ownership: 'generated', sharedEventKey: requireStableKey(sharedEventKey, 'sharedEventKey') }
}

/** Creates validated provenance for a generated group prescription. */
export function generatedPrescriptionProvenance(
  generationKey: string,
): SessionPrescriptionGenerationProvenance {
  return { ownership: 'generated', generationKey: requireStableKey(generationKey, 'generationKey') }
}

export function manualEventProvenance(): SessionEventGenerationProvenance {
  return { ownership: 'manual', sharedEventKey: null }
}

export function manualPrescriptionProvenance(): SessionPrescriptionGenerationProvenance {
  return { ownership: 'manual', generationKey: null }
}

function requireStableKey(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new RangeError(`${field} cannot be empty`)
  return normalized
}
