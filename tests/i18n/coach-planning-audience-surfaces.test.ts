import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const SURFACES = [
  'app/[locale]/dashboard/groups/page.tsx',
  'app/[locale]/dashboard/groups/new/page.tsx',
  'app/[locale]/dashboard/cohorts/page.tsx',
  'app/[locale]/dashboard/cohorts/new/page.tsx',
] as const

describe('KAN-515 Coach audience entry surfaces', () => {
  it('loads localized Coach audience copy on every entry surface', async () => {
    for (const path of SURFACES) {
      const source = await readFile(path, 'utf8')

      assert.match(source, /getTranslations/)
      assert.match(source, /CoachPlanningAudience/)
    }
  })

  it('does not expose legacy Cohorte/Cohortes vocabulary in the localized entry surfaces', async () => {
    for (const path of SURFACES) {
      const source = await readFile(path, 'utf8')

      assert.doesNotMatch(source, />[^<{]*Cohortes?[^<{]*</i)
      assert.doesNotMatch(source, /['"`]([^'"`]*\bCohortes?\b[^'"`]*)['"`]/i)
    }
  })
})
