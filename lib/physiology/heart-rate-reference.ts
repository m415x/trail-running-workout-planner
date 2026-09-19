export const HEART_RATE_REFERENCE_POLICY = {
  id: 'heart-rate-reference',
  version: '1.0.0',
} as const

interface KnownHeartRateEvidence {
  readonly maxHr: number
  readonly restHr?: number
  readonly source: string
  readonly observedAt: string
}

interface KnownProvenance {
  readonly kind: 'known'
  readonly source: string
  readonly observedAt: string
}

interface AgePredictedProvenance {
  readonly kind: 'age_predicted'
  readonly formula: 'tanaka_2001'
  readonly formulaVersion: '208 - 0.7 × age'
  readonly ageYears: number
  readonly birthday: string
  readonly effectiveDate: string
}

type HeartRateProvenance = KnownProvenance | AgePredictedProvenance

type RestHeartRateReference =
  | {
      readonly status: 'available'
      readonly bpm: number
      readonly provenance: KnownProvenance
    }
  | { readonly status: 'unknown' }

export type HeartRateReference =
  | {
      readonly status: 'available'
      readonly policyVersion: typeof HEART_RATE_REFERENCE_POLICY.version
      readonly maxHr: {
        readonly bpm: number
        readonly provenance: HeartRateProvenance
      }
      readonly restHr: RestHeartRateReference
    }
  | {
      readonly status: 'unknown'
      readonly policyVersion: typeof HEART_RATE_REFERENCE_POLICY.version
    }

interface ResolveHeartRateReferenceInput {
  readonly effectiveDate: string
  readonly birthday?: string | null
  readonly known?: KnownHeartRateEvidence | null
}

function ageAtDate(birthday: string, effectiveDate: string): number | null {
  const birth = new Date(`${birthday}T00:00:00Z`)
  const effective = new Date(`${effectiveDate}T00:00:00Z`)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(effective.getTime()) || birth > effective) {
    return null
  }

  let age = effective.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayOccurred =
    effective.getUTCMonth() > birth.getUTCMonth() ||
    (effective.getUTCMonth() === birth.getUTCMonth() &&
      effective.getUTCDate() >= birth.getUTCDate())

  if (!birthdayOccurred) age -= 1
  return age
}

export function resolveHeartRateReference({
  effectiveDate,
  birthday,
  known,
}: ResolveHeartRateReferenceInput): HeartRateReference {
  if (known && Number.isFinite(known.maxHr) && known.maxHr > 0) {
    const provenance: KnownProvenance = {
      kind: 'known',
      source: known.source,
      observedAt: known.observedAt,
    }

    return {
      status: 'available',
      policyVersion: HEART_RATE_REFERENCE_POLICY.version,
      maxHr: {
        bpm: known.maxHr,
        provenance,
      },
      restHr:
        known.restHr !== undefined &&
        Number.isFinite(known.restHr) &&
        known.restHr > 0 &&
        known.restHr < known.maxHr
          ? {
              status: 'available',
              bpm: known.restHr,
              provenance,
            }
          : { status: 'unknown' },
    }
  }

  if (birthday) {
    const ageYears = ageAtDate(birthday, effectiveDate)
    if (ageYears !== null) {
      return {
        status: 'available',
        policyVersion: HEART_RATE_REFERENCE_POLICY.version,
        maxHr: {
          bpm: 208 - 0.7 * ageYears,
          provenance: {
            kind: 'age_predicted',
            formula: 'tanaka_2001',
            formulaVersion: '208 - 0.7 × age',
            ageYears,
            birthday,
            effectiveDate,
          },
        },
        restHr: { status: 'unknown' },
      }
    }
  }

  return {
    status: 'unknown',
    policyVersion: HEART_RATE_REFERENCE_POLICY.version,
  }
}
