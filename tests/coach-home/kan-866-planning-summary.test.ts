import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectCoachHomePlanning } from '@/lib/coach-home/planning-summary'

type Week = {
  id: string
  weekNumber: number
  startDate: string
  endDate: string
  type: string
  targetVolumeKm: number | null
  isDeleted: boolean
}
type Plan = {
  id: string
  teamId: string
  groupId: string
  title: string
  status: string
  sourceGroupTrainingPlanId: string | null
  macrocycles: {
    isDeleted: boolean
    mesocycles: { isDeleted: boolean; microcycles: Week[] }[]
  }[]
}
const micro = (id: string, startDate: string, endDate: string, volume: number | null = null): Week => ({
  id, weekNumber: 1, startDate, endDate, type: 'base', targetVolumeKm: volume, isDeleted: false,
})
const plan = (id: string, groupId: string, weeks: Week[], other: Partial<Plan> = {}): Plan => ({
  id, groupId, teamId: 'team_A', title: id, status: 'active',
  sourceGroupTrainingPlanId: null,
  macrocycles: [{ isDeleted: false, mesocycles: [{ isDeleted: false, microcycles: weeks }] }],
  ...other,
})

describe('KAN-866/T3 Coach Home Plan-scoped microcycle summary', () => {
  it('preserves DENY, H3 unresolved and operational errors without creating an empty Plan summary', () => {
    for (const status of ['denied', 'selection_required', 'invalid_context', 'error'] as const) {
      assert.deepEqual(projectCoachHomePlanning({ status }, '2026-11-03'), { status })
    }
    assert.deepEqual(projectCoachHomePlanning({ status: 'empty' }, '2026-11-03'), { status: 'empty' })
  })

  it('keeps overlapping current microcycles attached to their own Plan and group, including variant', () => {
    const base = plan('base', 'group_A', [
      micro('past', '2026-10-26', '2026-11-01'),
      micro('current', '2026-11-02', '2026-11-08', 38),
      micro('next', '2026-11-09', '2026-11-15'),
    ])
    const variant = plan('variant', 'group_A', [micro('variant-week', '2026-11-03', '2026-11-09', 27)], {
      sourceGroupTrainingPlanId: 'base',
    })
    const another = plan('other', 'group_B', [micro('other-week', '2026-11-02', '2026-11-08', 42)])
    const result = projectCoachHomePlanning({ status: 'ready', plans: [another, variant, base] }, '2026-11-03')
    assert.equal(result.status, 'ready')
    if (result.status !== 'ready') throw new Error('planning summary unavailable')
    assert.equal(result.planCount, 3)
    assert.deepEqual(result.plans.map((p) => p.id), ['base', 'other', 'variant'])
    assert.deepEqual(result.plans.find((p) => p.id === 'base')?.weeks.map((w) => [w.id, w.relative]), [
      ['past', 'past'], ['current', 'current'], ['next', 'future'],
    ])
    assert.equal(result.plans.find((p) => p.id === 'base')?.weeks[1]?.targetVolumeKm, 38)
    assert.equal(result.plans.find((p) => p.id === 'variant')?.sourceGroupTrainingPlanId, 'base')
    assert.equal(result.plans.find((p) => p.id === 'other')?.groupId, 'group_B')
  })

  it('does not invent zero volume, status On Track, or silently mix deleted and foreign Plan records', () => {
    const good = plan('own', 'group_A', [
      micro('unknown-target', '2026-11-03', '2026-11-09'),
      { ...micro('deleted', '2026-11-03', '2026-11-09'), isDeleted: true },
    ])
    const foreign = plan('foreign', 'group_B', [micro('secret', '2026-11-03', '2026-11-09')], { teamId: 'team_B' })
    assert.deepEqual(projectCoachHomePlanning({
      status: 'ready',
      plans: [good, foreign],
    }, '2026-11-03').status, 'ready')
    const summary = projectCoachHomePlanning({ status: 'ready', plans: [good] }, '2026-11-03')
    if (summary.status !== 'ready') throw new Error('expected ready')
    assert.equal(summary.plans[0]?.weeks.length, 1)
    assert.equal(summary.plans[0]?.weeks[0]?.targetVolumeKm, null)
    assert.equal(JSON.stringify(summary).includes('On Track'), false)
    // Foreign ownership must be filtered by the existing authenticated planning list reader
    // before projection, never by a client-provided teamId.
  })
})
