import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync(
  'app/[locale]/dashboard/competitions/[[...segments]]/page.tsx',
  'utf8',
)

describe('coach RaceEdition registration route wiring', () => {
  it('loads team-scoped edition registrations and renders the collective registration surface', () => {
    assert.match(page, /listRaceRegistrationsInEdition/)
    assert.match(page, /projectRaceEditionRegistrations/)
    assert.match(page, /<EditionRegistrations/)
    assert.match(page, /teamId:\s*'team_1'/)
    assert.match(page, /raceEditionId:\s*edition\.id/)
  })
})
