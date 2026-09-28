import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import enGroup from '@/messages/en/athletes/group.json'
import esGroup from '@/messages/es/athletes/group.json'

const SERVER_SURFACES = [
  'app/[locale]/dashboard/groups/[groupId]/page.tsx',
  'app/[locale]/dashboard/cohorts/[cohortId]/page.tsx',
] as const

describe('KAN-515 Coach audience detail and form surfaces', () => {
  it('localizes the sporting-group and planning-subgroup detail pages', async () => {
    for (const path of SERVER_SURFACES) {
      const source = await readFile(path, 'utf8')

      assert.match(source, /getTranslations/)
      assert.match(source, /CoachPlanningAudience/)
    }
  })

  it('localizes the planning-subgroup form instead of exposing Cohorte copy', async () => {
    const source = await readFile(
      'features/planning-cohorts/components/PlanningCohortForm.tsx',
      'utf8',
    )

    assert.match(source, /useTranslations/)
    assert.match(source, /CoachPlanningAudience/)
    assert.doesNotMatch(source, />[^<{]*Cohorte[^<{]*</i)
    assert.doesNotMatch(source, /['"`]([^'"`]*\bCohorte\b[^'"`]*)['"`]/i)
  })

  it('uses Sporting group / Grupo deportivo in the athlete group workflow copy', () => {
    assert.equal(esGroup.AthleteGroup.currentGroup, 'Grupo deportivo actual')
    assert.equal(esGroup.AthleteGroup.newGroup, 'Nuevo grupo deportivo')
    assert.equal(esGroup.AthleteGroup.assignGroup, 'Asignar grupo deportivo')
    assert.equal(esGroup.AthleteGroup.changeGroup, 'Cambiar grupo deportivo')

    assert.equal(enGroup.AthleteGroup.currentGroup, 'Current sporting group')
    assert.equal(enGroup.AthleteGroup.newGroup, 'New sporting group')
    assert.equal(enGroup.AthleteGroup.assignGroup, 'Assign sporting group')
    assert.equal(enGroup.AthleteGroup.changeGroup, 'Change sporting group')
  })
})
