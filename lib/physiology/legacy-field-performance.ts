import type { FieldPerformanceTestRow } from '@/lib/physiology/field-performance-test-history'
import type { PhysiologyRecord } from '@/types/athlete/physiology.types'

/**
 * Promotes only legacy rows whose protocol was explicitly recorded as a
 * 1000 m track test. Ambiguous legacy physiology remains legacy data.
 */
export function promoteLegacy1000mEvidence(
  record: PhysiologyRecord,
): FieldPerformanceTestRow | null {
  if (record.testType !== '1000m_track') return null

  return {
    id: record.id,
    athleteId: record.athleteId,
    performedAt: record.date,
    protocol: '1000m_track',
    distanceM: 1000,
    elapsedTimeSec: record.pamTimeSec,
    notes: record.notes ?? null,
    isDeleted: record.isDeleted,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
