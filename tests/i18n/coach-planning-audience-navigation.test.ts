import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const SERVER_SURFACES = [
  'app/[locale]/dashboard/groups/[groupId]/edit/page.tsx',
  'app/[locale]/dashboard/cohorts/[cohortId]/edit/page.tsx',
  'app/[locale]/dashboard/cohorts/[cohortId]/members/new/page.tsx',
  'app/[locale]/dashboard/cohorts/[cohortId]/members/[membershipId]/close/page.tsx',
] as const

describe('KAN-515 remaining Coach audience navigation and return paths', () => {
  it('localizes all remaining sporting-group and planning-subgroup workflow pages', async () => {
    for (const path of SERVER_SURFACES) {
      const source = await readFile(path, 'utf8')

      assert.match(source, /getTranslations/)
      assert.match(source, /CoachPlanningAudience/)
      assert.doesNotMatch(source, />[^<{]*Cohortes?[^<{]*</i)
      assert.doesNotMatch(source, /['"`]([^'"`]*\bCohortes?\b[^'"`]*)['"`]/i)
    }
  })

  it('uses the approved audience vocabulary in the Coach sidebar', async () => {
    const source = await readFile('components/dashboard/app-sidebar.tsx', 'utf8')

    assert.match(source, /CoachPlanningAudience/)
    assert.doesNotMatch(source, /label:\s*['"]Grupos['"]/)
    assert.doesNotMatch(source, /label:\s*['"]Cohortes['"]/)
  })
})
