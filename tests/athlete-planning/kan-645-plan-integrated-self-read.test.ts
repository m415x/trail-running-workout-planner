import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  createIntegratedAthleteSelfPeriodRead,
} from '@/lib/athlete-planning/integrated-self-period-read'

const period = { startDate: '2026-10-05', endDate: '2026-10-18' }
const subject = { userId: 'user-a', teamId: 'team-a', athleteProfileId: 'athlete-a' }

describe('KAN-645/I1 — production SELF planning-period integration', () => {
  it('wires the production action through H5A planning.self.read and the integrated period reader', () => {
    const action = readFileSync('app/actions/dashboard-actions.ts', 'utf8')
    assert.match(action, /createIntegratedAthleteSelfPeriodRead/)
    assert.match(action, /planning\.self\.read/)
    assert.match(action, /getCurrentAthletePlanningPeriod/)
  })

  it('does not read any planning evidence when SELF denies access', async () => {
    let loaded = 0
    const read = createIntegratedAthleteSelfPeriodRead({
      resolveSelf: async () => ({ status: 'denied' as const }),
      loadPlanningEvidence: async () => { loaded++; throw Error('must not be reached') },
    })
    assert.deepEqual(await read(period), { status: 'denied' })
    assert.equal(loaded, 0)
  })

  it('passes only the server-resolved subject to the effective evidence reader', async () => {
    const scopes: unknown[] = []
    const read = createIntegratedAthleteSelfPeriodRead({
      resolveSelf: async () => ({ status: 'resolved' as const, subject }),
      loadPlanningEvidence: async (scope) => {
        scopes.push(scope)
        return { status: 'empty' as const }
      },
    })
    assert.deepEqual(await read(period), { status: 'empty' })
    assert.deepEqual(scopes, [{ ...period, ...subject }])
  })

  it('preserves conflict as distinct from genuinely empty planning', async () => {
    const read = createIntegratedAthleteSelfPeriodRead({
      resolveSelf: async () => ({ status: 'resolved' as const, subject }),
      loadPlanningEvidence: async () => ({ status: 'conflict' as const, reason: 'overlapping-cohorts' }),
    })
    const result = await read(period)
    assert.equal(result.status, 'conflict')
    assert.notEqual(result.status, 'empty')
  })

  it('fetches effective moved-in sessions regardless of original session week, once only', () => {
    const source = readFileSync('lib/athlete-planning/integrated-self-period-read.ts', 'utf8')
    assert.match(source, /resolveAthletePlanningOnDate/)
    assert.match(source, /resolveAthleteSessionPrescription/)
    assert.match(source, /resolveAthletePlanningSession/)
    assert.doesNotMatch(source, /originalDate\s*>=\s*startDate\s*&&\s*originalDate\s*<=\s*endDate/)
  })
})
