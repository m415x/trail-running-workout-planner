import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createAthletePlanRequestState,
} from '@/lib/athlete-planning/plan-request-state'

describe('KAN-645/T7 — fail-closed Athlete Plan request states', () => {
  it('clears previously authorized content when revalidation begins', () => {
    const controller = createAthletePlanRequestState<string[]>()
    const first = controller.begin()
    controller.settle(first, { status: 'loaded', data: ['private-week-A'] })
    assert.deepEqual(controller.current(), { status: 'loaded', data: ['private-week-A'] })

    const second = controller.begin()
    assert.deepEqual(controller.current(), { status: 'loading' })
    controller.settle(second, { status: 'denied' })
    assert.deepEqual(controller.current(), { status: 'denied' })
  })

  it('does not revive privileged results from a superseded request', () => {
    const controller = createAthletePlanRequestState<string[]>()
    const old = controller.begin()
    const latest = controller.begin()
    controller.settle(latest, { status: 'denied' })
    controller.settle(old, { status: 'loaded', data: ['stale-sensitive-week'] })
    assert.deepEqual(controller.current(), { status: 'denied' })
  })

  it('preserves authorized empty, retrieval error and access DENY as distinct states', () => {
    const controller = createAthletePlanRequestState<string[]>()
    const empty = controller.begin()
    controller.settle(empty, { status: 'empty' })
    assert.deepEqual(controller.current(), { status: 'empty' })

    const failed = controller.begin()
    controller.settle(failed, { status: 'error' })
    assert.deepEqual(controller.current(), { status: 'error' })

    const denied = controller.begin()
    controller.settle(denied, { status: 'denied' })
    assert.deepEqual(controller.current(), { status: 'denied' })
  })

  it('does not let a stale error overwrite a newer authorized period', () => {
    const controller = createAthletePlanRequestState<string[]>()
    const earlier = controller.begin()
    const later = controller.begin()
    controller.settle(later, { status: 'loaded', data: ['week-B'] })
    controller.settle(earlier, { status: 'error' })
    assert.deepEqual(controller.current(), { status: 'loaded', data: ['week-B'] })
  })
})
