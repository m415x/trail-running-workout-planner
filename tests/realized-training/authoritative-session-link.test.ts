import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  InvalidRealizedTrainingSessionLinkError,
  resolveAuthoritativeSessionLink,
} from '@/lib/realized-training/authoritative-session-link'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

const unknown = { state: 'unknown' } as const

function capture(overrides: Partial<ManualRealizedTrainingCaptureInput> = {}): ManualRealizedTrainingCaptureInput {
  return {
    athleteId: 'athlete-1',
    sessionId: 'session-1',
    workoutId: 'client-workout',
    date: '2026-09-13',
    performedAt: '2026-09-13T08:30:00-03:00',
    status: 'completed',
    metrics: {
      distanceKm: unknown,
      durationMin: unknown,
      elevationGainM: unknown,
      avgHrBpm: unknown,
      rpe: unknown,
    },
    feeling: null,
    athleteNotes: null,
    ...overrides,
  }
}

const athlete = {
  id: 'athlete-1',
  teamId: 'team-1',
  isDeleted: false,
} as const

const session = {
  id: 'session-1',
  teamId: 'team-1',
  workoutId: 'authoritative-workout',
  isDeleted: false,
} as const

describe('authoritative realized training session linkage', () => {
  it('uses the exact selected session and derives its workout id', () => {
    const result = resolveAuthoritativeSessionLink({ capture: capture(), athlete, session })

    assert.equal(result.sessionId, 'session-1')
    assert.equal(result.workoutId, 'authoritative-workout')
  })

  it('allows a free workout without any session link', () => {
    const freeCapture = capture({ sessionId: null, workoutId: null })
    const result = resolveAuthoritativeSessionLink({ capture: freeCapture, athlete, session: null })

    assert.equal(result.sessionId, null)
    assert.equal(result.workoutId, null)
  })

  it('rejects a session from another team', () => {
    assert.throws(
      () => resolveAuthoritativeSessionLink({
        capture: capture(),
        athlete,
        session: { ...session, teamId: 'team-2' },
      }),
      (error) => error instanceof InvalidRealizedTrainingSessionLinkError
        && error.reason === 'cross_team_session',
    )
  })

  it('rejects a missing or deleted selected session', () => {
    assert.throws(
      () => resolveAuthoritativeSessionLink({ capture: capture(), athlete, session: null }),
      (error) => error instanceof InvalidRealizedTrainingSessionLinkError
        && error.reason === 'session_not_found',
    )

    assert.throws(
      () => resolveAuthoritativeSessionLink({
        capture: capture(),
        athlete,
        session: { ...session, isDeleted: true },
      }),
      (error) => error instanceof InvalidRealizedTrainingSessionLinkError
        && error.reason === 'session_not_found',
    )
  })

  it('rejects a missing or deleted athlete scope', () => {
    assert.throws(
      () => resolveAuthoritativeSessionLink({ capture: capture(), athlete: null, session }),
      (error) => error instanceof InvalidRealizedTrainingSessionLinkError
        && error.reason === 'athlete_not_found',
    )
  })
})
