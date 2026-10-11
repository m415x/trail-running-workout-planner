import assert from 'node:assert/strict'
import test from 'node:test'
import {
  listFieldPerformanceTestAuditHistory,
  type FieldPerformanceTestRow,
} from '../../lib/physiology/field-performance-test-history'

test('KAN-733 audit history retains invalidated revisions and unknown legacy actor without mixing athletes', () => {
  const base: FieldPerformanceTestRow = {
    id: 'legacy', athleteId: 'athlete-a', performedAt: '2026-10-01',
    protocol: '1000m_track', source: 'coach_manual', distanceM: 1000,
    elapsedTimeSec: 315, notes: null, isDeleted: true,
    createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
    recordedByUserId: null, reviewedByUserId: null,
  }
  const history = listFieldPerformanceTestAuditHistory([
    { ...base, id: 'other-team', athleteId: 'athlete-b', recordedByUserId: 'other-user' },
    { ...base, id: 'revision', isDeleted: false, recordedByUserId: 'real-actor', createdAt: '2026-10-02T12:00:00Z' },
    base,
  ], 'athlete-a')
  assert.deepEqual(history.map(row => row.id), ['legacy', 'revision'])
  assert.equal(history[0].isDeleted, true)
  assert.equal(history[0].recordedByUserId, null)
  assert.equal(history[1].recordedByUserId, 'real-actor')
})
