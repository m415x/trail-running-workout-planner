import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const groupActions = readFileSync('app/actions/group-actions.ts', 'utf8')
const athleteActions = readFileSync('app/actions/athlete-actions.ts', 'utf8')
const assignmentAction = readFileSync('lib/athletes/group-assignment-action.ts', 'utf8')

function section(source: string, startMarker: string, endMarker?: string): string {
  const start = source.indexOf(startMarker)
  const end = endMarker ? source.indexOf(endMarker, start) : source.length
  assert.notEqual(start, -1, `missing marker: ${startMarker}`)
  if (endMarker) assert.notEqual(end, -1, `missing marker: ${endMarker}`)
  return source.slice(start, end)
}

describe('KAN-664 authorized mixed Athlete/Group reads', () => {
  it('centralizes both administrative capabilities against stored group ownership', () => {
    const helper = section(
      groupActions,
      'async function authorizeMixedGroupRead',
      'export async function getEligibleAthletesForGroup',
    )

    assert.match(helper, /athleteGroups\.id/)
    assert.match(helper, /resource:\s*\{\s*teamId:\s*group\.teamId/)
    assert.match(helper, /capability:\s*['"]athlete\.admin\.manage['"]/)
    assert.match(helper, /capability:\s*['"]sporting_group\.admin\.manage['"]/)
    assert.match(helper, /requiredScope:\s*['"]team['"]/)
    assert.doesNotMatch(helper, /CURRENT_TEAM_ID/)
  })

  for (const [start, end] of [
    ['export async function getEligibleAthletesForGroup', 'export async function getGroupWithMembers'],
    ['export async function getGroupWithMembers', 'export async function createGroup'],
  ] as const) {
    it(`${start} delegates to the mixed authorization boundary`, () => {
      const body = section(groupActions, start, end)

      assert.match(body, /authorizeMixedGroupRead\(groupId\)/)
      assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
    })
  }
})

describe('KAN-664 authorized Athlete to Sporting Group movement', () => {
  it('constructs the assignment action without fixed Team authority', () => {
    const body = section(athleteActions, 'export const assignAthleteToGroup')

    assert.doesNotMatch(body, /CURRENT_TEAM_ID/)
    assert.match(body, /requireAuthenticatedEptAction/)
    assert.match(body, /createH4aNextServerAuthorizationBoundary/)
  })

  it('requires both capabilities before invoking the atomic assignment boundary', () => {
    assert.match(assignmentAction, /capability:\s*['"]athlete\.admin\.manage['"]/)
    assert.match(assignmentAction, /capability:\s*['"]sporting_group\.admin\.manage['"]/)
    assert.match(assignmentAction, /assignAthleteToGroupSynchronously/)
    assert.ok(
      assignmentAction.indexOf('athlete.admin.manage') < assignmentAction.indexOf('assignAthleteToGroupSynchronously'),
    )
    assert.ok(
      assignmentAction.indexOf('sporting_group.admin.manage') < assignmentAction.indexOf('assignAthleteToGroupSynchronously'),
    )
  })

  it('derives changedByUserId from authenticated H2 access and never from client input', () => {
    assert.match(assignmentAction, /changedByUserId:\s*access\.userId/)
    assert.doesNotMatch(assignmentAction, /changedByUserId:\s*null/)
    assert.doesNotMatch(assignmentAction, /formData\.get\(['"]changedByUserId['"]\)/)
  })

  it('uses stored AthleteProfile and destination group ownership, including active destination validation', () => {
    assert.match(assignmentAction, /athleteProfiles\.id/)
    assert.match(assignmentAction, /athleteGroups\.id/)
    assert.match(assignmentAction, /athleteGroups\.isActive/)
    assert.match(assignmentAction, /athlete\.teamId/)
    assert.match(assignmentAction, /newGroup\.teamId/)
  })

  it('treats returnContext only as navigation input and never as authorization denial', () => {
    assert.match(assignmentAction, /returnContext/)
    assert.doesNotMatch(
      assignmentAction,
      /returnGroupId\s*!==\s*data\.newGroupId[\s\S]*return\s*\{\s*error:/,
    )
  })
})
