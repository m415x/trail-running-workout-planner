import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const edition = readFileSync(
  'features/race-registration/components/EditionRegistrations.tsx',
  'utf8',
)
const editor = readFileSync(
  'features/race-registration/components/RaceParticipationEditor.tsx',
  'utf8',
)

describe('coach RaceEdition participation editor', () => {
  it('submits explicit participation and factual result fields through the server action', () => {
    assert.match(editor, /updateRaceParticipationFormAction/)
    assert.match(editor, /name=['"]registrationId['"]/)
    assert.match(editor, /name=['"]participationStatus['"]/)
    assert.match(editor, /name=['"]actualDistanceKm['"]/)
    assert.match(editor, /name=['"]elapsedTimeSeconds['"]/)
  })

  it('offers explicit lifecycle states without inferring a result from nominal course facts', () => {
    assert.match(editor, /value=['"]unknown['"]/)
    assert.match(editor, /value=['"]started['"]/)
    assert.match(editor, /value=['"]finished['"]/)
    assert.match(editor, /value=['"]dnf['"]/)
    assert.match(editor, /value=['"]dns['"]/)
    assert.doesNotMatch(editor, /nominalDistanceKm[^\n]*(actualDistanceKm|value=)/)
  })
})
