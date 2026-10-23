import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'
import { createH4aActiveTeamAuthorizationBoundary } from '@/lib/authorization/h4a-active-team-authorization'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'

const at = '2026-10-23T12:00:00.000Z'
const userId = 'kan849-coach'
const teamId = 'kan849-team-valid'
const access = { status: 'authenticated' as const, userId }
const request = {
  capability: 'athlete.admin.manage' as const,
  resource: { teamId },
  at,
  requiredScope: 'team' as const,
}

test('KAN-849/T3 real H3→H4A boundary distinguishes valid, forged and revoked Team', async () => {
  let selectedTeam = teamId
  let membershipActive = true
  const resolutions: string[] = []
  const evidenceReads: string[] = []

  const adapter = createH4aAuthorizationAdapter({
    async loadMemberships(actor, targetTeam) {
      evidenceReads.push('membership:' + actor + ':' + targetTeam)
      if (targetTeam !== teamId) return []
      return [{
        userId: actor,
        teamId: targetTeam,
        preset: 'coach' as const,
        isActive: membershipActive,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveUntil: null,
      }]
    },
    async loadAthleteProfiles() { return [] },
    async loadGrants() { return [] },
  })

  const boundary = createH4aActiveTeamAuthorizationBoundary({
    async resolveActiveTeam(actor) {
      resolutions.push(actor + ':' + selectedTeam)
      return resolveActiveTeamContext({
        persistedTeamId: selectedTeam,
        memberships: [{
          teamId,
          isActive: membershipActive,
          isDeleted: false,
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveUntil: null,
        }],
        onDate: at,
      })
    },
    authorize: (identity, input) => adapter.authorize(identity, input),
  })

  const valid = await boundary.authorize(access, request)
  assert.deepEqual(valid, { allowed: true, teamId })
  assert.equal(evidenceReads.length, 1, 'H4A must evaluate persisted Coach evidence')

  selectedTeam = 'kan849-team-forged'
  const forged = await boundary.authorize(access, request)
  assert.deepEqual(forged, { allowed: false })
  assert.equal(evidenceReads.length, 1, 'Forged Team must stop before H4A evidence')

  selectedTeam = teamId
  membershipActive = false
  const revoked = await boundary.authorize(access, request)
  assert.deepEqual(revoked, { allowed: false })
  assert.equal(evidenceReads.length, 1, 'Revoked Team must stop before H4A evidence')

  membershipActive = true
  const validAgain = await boundary.authorize(access, request)
  assert.deepEqual(validAgain, { allowed: true, teamId })
  assert.equal(evidenceReads.length, 2, 'Restored context must re-read H4A evidence')
  assert.deepEqual(resolutions, [
    userId + ':' + teamId,
    userId + ':kan849-team-forged',
    userId + ':' + teamId,
    userId + ':' + teamId,
  ])
  process.stdout.write('KAN-849 H3_H4A_BOUNDARY_CHARACTERIZATION ' + JSON.stringify({
    valid:valid.allowed,forged:forged.allowed,revoked:revoked.allowed,
    restored:validAgain.allowed,evidenceReads:evidenceReads.length,
    stateRestored:membershipActive && selectedTeam === teamId,
  }) + '\n')
})
