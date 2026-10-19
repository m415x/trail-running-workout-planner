import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const action = readFileSync('app/actions/competition-calendar-actions.ts', 'utf8')
const preview = readFileSync('app/[locale]/dashboard/planning/[planId]/page.tsx', 'utf8')
const raceCatalog = readFileSync('lib/race-catalog/catalog-repository.ts', 'utf8')
const reader = readFileSync('lib/periodization/authorized-competition-calendar-reader.ts', 'utf8')

function actionBody(name: string): string {
  const start = action.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `Expected Server Action ${name}`)
  const next = action.indexOf('\nexport async function ', start + 1)
  return action.slice(start, next < 0 ? undefined : next)
}

test('KAN-792/T1 calendar reader must never derive plan authority from the fixed fixture Team', () => {
  assert.doesNotMatch(reader, /CURRENT_TEAM_ID\s*=\s*'team_1'/)
  assert.doesNotMatch(actionBody('getCompetitionCalendarAction'), /CURRENT_TEAM_ID|requireAccessiblePlan\(/)
  assert.doesNotMatch(action, /CURRENT_TEAM_ID\s*=\s*'team_1'/,
    'KAN-798 removes the historical fixed-Team writer fixture without weakening the reader boundary')
  assert.match(reader, /requireAuthenticatedEptAction/)
  assert.match(action, /createActiveTeamNextServerContext/)
  assert.match(action, /createH4aNextServerAuthorizationBoundary/)
  assert.match(reader, /capability:\s*'planning\.manage'/)
  assert.match(actionBody('getCompetitionCalendarAction'), /requireAuthorizedCompetitionCalendarPlan\(/,
    'The real calendar reader must use a request-scoped H2/H3/H4A Plan resource boundary')
})

test('KAN-792/T1 DENY in the preview must not silently become an empty competition calendar', () => {
  assert.match(preview, /getCompetitionCalendarAction\(\{\s*planId,\s*locale:/)
  assert.doesNotMatch(preview, /competitionCalendarResult\.ok\s*\?\s*competitionCalendarResult\.value\s*:\s*\[\]/)
  assert.match(preview, /competitionCalendarResult\.ok/,
    'Preview must explicitly distinguish authorization failure from an authorized empty calendar')
})

test('KAN-792/T1 freeze writer and catalog exclusions pending their independent regression', () => {
  for (const writer of [
    'createCompetitionAction', 'updateCompetitionAction',
    'rescheduleCompetitionAction', 'changeCompetitionStatusAction',
    'createCompetitionFromCatalogAction',
  ]) {
    assert.ok(actionBody(writer).length > 0, `Preserve existing ${writer} entry point`)
  }
  assert.match(reader, /getCompetitionCalendar\(planId, deps\.database\)/,
    'Calendar remains Plan-owned; no global entry listing')
  assert.match(raceCatalog, /raceCourse|raceEvent|raceEdition/,
    'Global race catalog stays a distinct read boundary')
})
