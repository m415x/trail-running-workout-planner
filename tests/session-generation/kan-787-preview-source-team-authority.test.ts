import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

const source = (path: string) => readFileSync(resolve(path), 'utf8')

const preview = source('app/[locale]/dashboard/planning/[planId]/page.tsx')
const templatesAction = source('app/actions/workout-template-actions.ts')
const competitionAction = source('app/actions/competition-calendar-actions.ts')

/**
 * KAN-787/T3a source-ownership RED, not a substitute for an authenticated
 * multi-Team SQLite/HTTP regression. The current preview and readers are the
 * production code paths, so these assertions make their disagreement explicit.
 */
test('KAN-787 preview resolves the team-scoped workout catalogue using its authorized plan Team', () => {
  assert.match(templatesAction, /eq\(workouts\.teamId,\s*teamId\)/,
    'Workout templates must be team-scoped rather than global')
  assert.match(preview, /getWorkoutTemplates\(\{\s*archive:\s*'active'\s*\},\s*plan\.group\.teamId\)/,
    'Plan preview currently defaults to team_1 even when the authorized plan belongs to another Team')
})

test('KAN-787 competition calendar authorization uses plan Team, not a fixed fixture Team', () => {
  assert.match(preview, /getCompetitionCalendarAction\(\{\s*planId,\s*locale:/,
    'Production preview must continue to read the plan calendar, not an invented global feed')
  assert.match(competitionAction, /getCompetitionCalendar\(input\.planId\)/,
    'The competition calendar is plan-scoped, not a global shared catalogue')
  assert.doesNotMatch(competitionAction,
    /plan\.group\.teamId\s*!==\s*CURRENT_TEAM_ID/,
    'The current reader denies authorized Team B plans because CURRENT_TEAM_ID is team_1')
})
