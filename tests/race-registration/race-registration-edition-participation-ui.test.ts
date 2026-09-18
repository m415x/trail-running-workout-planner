import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync(
  'features/race-registration/components/EditionRegistrations.tsx',
  'utf8',
)

describe('coach RaceEdition participation editor', () => {
  it('submits explicit participation and factual result fields through the server action', () => {
    assert.match(component, /updateRaceParticipationFormAction/)
    assert.match(component, /name=['"]registrationId['"]/)
    assert.match(component, /name=['"]participationStatus['"]/)
    assert.match(component, /name=['"]actualDistanceKm['"]/)
    assert.match(component, /name=['"]elapsedTimeSeconds['"]/)
  })

  it('offers explicit lifecycle states without inferring a result from nominal course facts', () => {
    assert.match(component, /value=['"]unknown['"]/)
    assert.match(component, /value=['"]started['"]/)
    assert.match(component, /value=['"]finished['"]/)
    assert.match(component, /value=['"]dnf['"]/)
    assert.match(component, /value=['"]dns['"]/)
    assert.doesNotMatch(component, /nominalDistanceKm[^\n]*(actualDistanceKm|value=)/)
  })
})
