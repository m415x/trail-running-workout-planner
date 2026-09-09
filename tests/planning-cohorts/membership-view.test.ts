import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isPlanningCohortMembershipActiveOn } from '@/lib/planning-cohorts/membership-view'

const membership = {
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  isDeleted: false,
}

describe('visualización de membresías de cohorte', () => {
  it('considera inclusivos ambos límites del período', () => {
    assert.equal(isPlanningCohortMembershipActiveOn(membership, '2026-09-01'), true)
    assert.equal(isPlanningCohortMembershipActiveOn(membership, '2026-09-30'), true)
  })

  it('distingue períodos futuros, finalizados y abiertos', () => {
    assert.equal(isPlanningCohortMembershipActiveOn(membership, '2026-08-31'), false)
    assert.equal(isPlanningCohortMembershipActiveOn(membership, '2026-10-01'), false)
    assert.equal(isPlanningCohortMembershipActiveOn({
      ...membership,
      endDate: null,
    }, '2030-01-01'), true)
  })

  it('oculta membresías eliminadas lógicamente', () => {
    assert.equal(isPlanningCohortMembershipActiveOn({
      ...membership,
      isDeleted: true,
    }, '2026-09-15'), false)
  })
})
