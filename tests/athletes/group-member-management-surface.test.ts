import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-516 sporting group member management surface', () => {
  it('exposes member management from the sporting-group detail', async () => {
    const source = await readFile(
      'app/[locale]/dashboard/groups/[groupId]/page.tsx',
      'utf8',
    )

    assert.match(source, /members\/new/)
    assert.match(source, /addMember|manageMembers/)
  })

  it('provides a dedicated group-context route that reuses the canonical assignment action', async () => {
    const page = await readFile(
      'app/[locale]/dashboard/groups/[groupId]/members/new/page.tsx',
      'utf8',
    )
    const form = await readFile(
      'features/groups/components/GroupMemberAssignmentForm.tsx',
      'utf8',
    )

    assert.match(page, /getEligibleAthletesForGroup/)
    assert.match(page, /GroupMemberAssignmentForm/)
    assert.match(form, /assignAthleteToGroup/)
    assert.match(form, /name=['"]newGroupId['"]/)
    assert.match(form, /name=['"]returnContext['"]/)
    assert.doesNotMatch(form, /remove|ungroup/i)
  })
})
