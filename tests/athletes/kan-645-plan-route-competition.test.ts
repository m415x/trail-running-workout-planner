import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
const competition = readFileSync('app/actions/athlete-stats-actions.ts', 'utf8')

test('KAN-645/I4 route obtains competition milestones through existing SELF stats boundary', () => {
  assert.match(page, /getCurrentAthleteRaceRegistrationsAction/)
  assert.match(page, /readAthletePlanCompetitionMilestones\(/)
  assert.match(competition, /stats\.self\.read/)
})

test('KAN-645/I4 route renders factual registrations without inferred plan goals', () => {
  assert.match(page, /milestones\.map\(/)
  assert.match(page, /registration/)
  assert.doesNotMatch(page, /explicitPlanGoalRegistrationIds:\s*\w+\.map\(/)
})

test('KAN-645/I4 denies and fails registration read without treating them as authorized empty milestones', () => {
  assert.match(page, /milestoneResult\.status\s*===\s*['"]denied['"]/)
  assert.match(page, /milestoneResult\.status\s*===\s*['"]error['"]/)
  assert.doesNotMatch(page, /milestoneResult\.status\s*!==\s*['"]loaded['"]\s*\?\s*\[\]/)
})
