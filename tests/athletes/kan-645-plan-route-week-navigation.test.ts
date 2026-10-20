import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { resolveSelectedAthletePlanWeek, shiftAthletePlanWeek } from '@/lib/athlete-planning/plan-week-navigation'

const page = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')

describe('KAN-645/I2 — real Athlete Plan route civil-week integration', () => {
  it('accepts Next.js searchParams and validates week before fetching server-owned planning', () => {
    assert.match(page, /searchParams/)
    assert.match(page, /resolveSelectedAthletePlanWeek\(/)
    assert.match(page, /getCurrentAthletePlanningPeriod\(/)
    assert.doesNotMatch(page, /const result = await getCurrentAthletePlanningWeek\(\)/)
  })

  it('binds previous/current/next navigation to a canonical locale-preserving ?week URL', () => {
    assert.match(page, /shiftAthletePlanWeek\(/)
    assert.match(page, /athletePlanWeekHref\(/)
    assert.match(page, /week=/)
    assert.equal(shiftAthletePlanWeek('2026-12-28', 1), '2027-01-04')
    assert.deepEqual(resolveSelectedAthletePlanWeek('2026-02-30', '2026-10-12'), { status: 'invalid' })
  })

  it('renders seven effective civil days and reuses existing session card, without client-authoritative athlete IDs', () => {
    assert.match(page, /selectEffectiveAthletePlanWeek\(/)
    assert.match(page, /AthleteSessionCard/)
    assert.doesNotMatch(page, /searchParams\.(?:athleteId|teamId)/)
  })

  it('preserves DENY, conflict, and error instead of normalizing failures to an empty week', () => {
    assert.match(page, /status\s*===\s*['"]denied['"]/)
    assert.match(page, /status\s*===\s*['"]conflict['"]/)
    assert.match(page, /status\s*===\s*['"]error['"]/)
  })
})
