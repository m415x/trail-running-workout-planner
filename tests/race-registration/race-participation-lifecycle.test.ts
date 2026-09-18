import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  correctRaceParticipation,
  recordRaceParticipation,
} from '@/lib/competitions/race-participation'
import type { RaceParticipationStatus } from '@/types/training/race-registration.types'

const statuses: RaceParticipationStatus[] = ['unknown', 'started', 'finished', 'dnf', 'dns']

describe('race participation lifecycle', () => {
  it('keeps absence of participation evidence explicitly unknown', () => {
    assert.equal(statuses.includes('unknown'), true)
    assert.equal(recordRaceParticipation('unknown', null), 'unknown')
  })

  it('supports normal factual progression without deriving participation from registration', () => {
    assert.equal(recordRaceParticipation('unknown', 'started'), 'started')
    assert.equal(recordRaceParticipation('started', 'finished'), 'finished')
    assert.equal(recordRaceParticipation('started', 'dnf'), 'dnf')
  })

  it('supports direct retrospective evidence from unknown', () => {
    assert.equal(recordRaceParticipation('unknown', 'finished'), 'finished')
    assert.equal(recordRaceParticipation('unknown', 'dnf'), 'dnf')
    assert.equal(recordRaceParticipation('unknown', 'dns'), 'dns')
  })

  it('does not silently replace existing evidence through ordinary recording', () => {
    assert.throws(() => recordRaceParticipation('finished', 'dnf'), /explicit correction/i)
    assert.throws(() => recordRaceParticipation('dns', 'started'), /explicit correction/i)
  })

  it('allows explicit factual correction without inventing an audit subsystem', () => {
    assert.equal(correctRaceParticipation('finished', 'dnf'), 'dnf')
    assert.equal(correctRaceParticipation('dns', 'finished'), 'finished')
    assert.equal(correctRaceParticipation('started', 'unknown'), 'unknown')
  })
})
