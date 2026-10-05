import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

const surfaces = [
  'lib/groups/eligible-athletes.ts',
  'lib/groups/group-members-read.ts',
  'features/groups/components/GroupMemberAssignmentForm.tsx',
  'app/[locale]/dashboard/groups/[groupId]/page.tsx',
  'app/[locale]/dashboard/athletes/[athleteId]/group/page.tsx',
  'app/[locale]/dashboard/cohorts/[cohortId]/page.tsx',
  'features/planning-cohorts/components/PlanningCohortMembershipForms.tsx',
  'app/[locale]/dashboard/cohorts/[cohortId]/members/[membershipId]/close/page.tsx',
  'app/actions/athlete-session-adjustment-actions.ts',
]

test('KAN-624 sporting consumers do not require AthleteProfile.user names', () => {
  for (const file of surfaces) {
    const value = source(file)
    assert.doesNotMatch(value, /athlete(?:Profile)?\.user\.(?:firstName|lastName|email)/, file)
  }
})

test('KAN-624 shared group/cohort presentation uses the administrative projection', () => {
  assert.match(source('features/groups/lib/group-member-option-label.ts'), /projectAthleteAdministrativeRead/)
  assert.match(source('features/groups/lib/group-member-detail-presentation.ts'), /projectAthleteAdministrativeRead/)
  assert.match(source('lib/planning-cohorts/member-order.ts'), /projectAthleteAdministrativeRead/)
  assert.match(source('app/actions/athlete-session-adjustment-actions.ts'), /projectAthleteAdministrativeRead/)
})
