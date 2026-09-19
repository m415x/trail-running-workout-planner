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
      isDeleted: record.isDeleted,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  } catch {
    return null
  }
}
