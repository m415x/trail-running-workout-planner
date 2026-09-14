import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  hasUnplannedTrainingOnDate,
  reconcileTrainingDayStatus,
} from '@/lib/realized-training/day-status-reconciliation'

describe('realized-training day status reconciliation', () => {
  it('marks a past planned session as missed only while no realized evidence exists', () => {
    assert.equal(reconcileTrainingDayStatus({
      date: '2026-09-13',
      today: '2026-09-14',
      hasPlannedSession: true,
      matchedEvidenceOutcome: null,
    }), 'missed')
  })

  it('keeps a planned session pending throughout its own local calendar day', () => {
    assert.equal(reconcileTrainingDayStatus({
      date: '2026-09-14',
      today: '2026-09-14',
      hasPlannedSession: true,
      matchedEvidenceOutcome: null,
    }), 'pending')
  })

  it('reconciles a previously missed session after a late completed capture or import', () => {
    assert.equal(reconcileTrainingDayStatus({
      date: '2026-09-13',
      today: '2026-09-14',
      hasPlannedSession: true,
      matchedEvidenceOutcome: 'completed',
    }), 'completed')
  })

  it('reconciles a previously missed session to partial when the compliance evaluator says partial', () => {
    assert.equal(reconcileTrainingDayStatus({
      date: '2026-09-13',
      today: '2026-09-14',
      hasPlannedSession: true,
      matchedEvidenceOutcome: 'partial',
    }), 'partial')
  })

  it('returns to missed if matched realized evidence is later removed', () => {
    const base = {
      date: '2026-09-13',
      today: '2026-09-14',
      hasPlannedSession: true,
    } as const

    assert.equal(reconcileTrainingDayStatus({ ...base, matchedEvidenceOutcome: 'completed' }), 'completed')
    assert.equal(reconcileTrainingDayStatus({ ...base, matchedEvidenceOutcome: null }), 'missed')
  })

  it('keeps an unplanned training day outside planned-session compliance', () => {
    assert.equal(reconcileTrainingDayStatus({
      date: '2026-09-12',
      today: '2026-09-14',
      hasPlannedSession: false,
      matchedEvidenceOutcome: null,
    }), 'rest')

    assert.equal(hasUnplannedTrainingOnDate([
      { date: '2026-09-12', sessionId: null },
    ], '2026-09-12'), true)
  })

  it('does not classify a linked realized workout as unplanned training', () => {
    assert.equal(hasUnplannedTrainingOnDate([
      { date: '2026-09-12', sessionId: 'session-1' },
    ], '2026-09-12'), false)
  })
})
