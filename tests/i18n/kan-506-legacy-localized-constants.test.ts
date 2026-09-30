import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 legacy localized constants cleanup', () => {
  it('removes localized calendar names from constants and date helpers', async () => {
    const constants = await readFile('lib/constants.ts', 'utf8')
    const dates = await readFile('lib/date-helpers.ts', 'utf8')

    assert.doesNotMatch(constants, /DAYS_OF_WEEK|MONTHS_OF_YEAR/)
    assert.doesNotMatch(
      dates,
      /DAYS_OF_WEEK|MONTHS_OF_YEAR|\['Ene', 'Feb', 'Mar'/,
    )
  })

  it('keeps HR zone constants structural instead of carrying localized prose', async () => {
    const source = await readFile('lib/constants.ts', 'utf8')

    assert.match(source, /HR_ZONES/)
    assert.doesNotMatch(
      source,
      /name:|workType:|description:|effortAndPerception:|breathingPathway:|rhythmicPattern:|biomechanicalFocus:/,
    )
  })

  it('preserves descriptive HR-zone guidance in the ES/EN domain glossary', async () => {
    for (const locale of ['es', 'en'] as const) {
      const messages = JSON.parse(
        await readFile(`messages/${locale}/glossary/planning.json`, 'utf8'),
      )
      const zones = messages.DomainGlossary.heartRateZones

      for (const zone of ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const) {
        assert.equal(typeof zones[zone].name, 'string')
        assert.equal(typeof zones[zone].workType, 'string')
        assert.equal(typeof zones[zone].description, 'string')
        assert.equal(typeof zones[zone].effortAndPerception, 'string')
        assert.equal(typeof zones[zone].breathingPathway, 'string')
        assert.equal(typeof zones[zone].rhythmicPattern, 'string')
        assert.equal(typeof zones[zone].biomechanicalFocus, 'string')
      }
    }
  })

  it('keeps RPE constants structural instead of carrying localized prose', async () => {
    const source = await readFile('lib/constants.ts', 'utf8')

    assert.match(source, /RPE_LEVELS/)
    assert.doesNotMatch(source, /label:|description:|details:/)
  })

  it('keeps athlete group metadata language-neutral', async () => {
    const source = await readFile('lib/constants.ts', 'utf8')

    assert.match(source, /ATHLETE_CATEGORIES/)
    assert.match(source, /ATHLETE_LEVELS/)
    assert.doesNotMatch(source, /name:|description:/)
  })

  it('localizes RPE and athlete-group presentation at their UI boundaries', async () => {
    const rpe = await readFile('features/workouts/components/RpeSelector.tsx', 'utf8')
    const groupMessages = await readFile('messages/en/athletes/group.json', 'utf8')
    const workoutMessages = await readFile('messages/en/realized-training/workouts.json', 'utf8')

    assert.match(rpe, /useTranslations\('Workouts/)
    assert.match(workoutMessages, /"rpe"/)
    assert.match(groupMessages, /"categories"/)
    assert.match(groupMessages, /"levels"/)
  })
})
