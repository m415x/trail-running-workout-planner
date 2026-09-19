import { createTrack1000mEvaluation } from '@/lib/physiology/field-performance-test'
import type { FieldPerformanceTestRow } from '@/lib/physiology/field-performance-test-history'
import type { PhysiologyRecord } from '@/types/athlete/physiology.types'

/**
 * Promotes only valid legacy rows whose protocol was explicitly recorded as a
 * 1000 m track test. Ambiguous or invalid legacy physiology remains legacy data.
 */
export function promoteLegacy1000mEvidence(
  record: PhysiologyRecord,
): FieldPerformanceTestRow | null {
  if (record.testType !== '1000m_track') return null

  try {
    const evidence = createTrack1000mEvaluation({
      athleteId: record.athleteId,
      performedAt: record.date,
      elapsedTimeSec: record.pamTimeSec,
      notes: record.notes,
    })

    return {
      id: record.id,
      ...evidence,
      notes: evidence.notes ?? null,
      isDeleted: record.isDeleted ?? false,
      createdAt: record.createdAt ?? record.date,
      updatedAt: record.updatedAt ?? record.createdAt ?? record.date,
    }
  } catch {
    return null
  }
}


export interface LegacyPhysiologyReconciliationPlan {
  readonly promoted: readonly FieldPerformanceTestRow[]
  readonly retainedLegacy: readonly PhysiologyRecord[]
}

/**
 * Builds a non-destructive reconciliation plan. Promotion is additive: source
 * legacy rows remain available until a separate, explicit retirement decision.
 */
export function planLegacyPhysiologyReconciliation(
  records: readonly PhysiologyRecord[],
): LegacyPhysiologyReconciliationPlan {
  return {
    promoted: records.flatMap(record => {
      const evidence = promoteLegacy1000mEvidence(record)
      return evidence ? [evidence] : []
    }),
    retainedLegacy: [...records],
  }
}
