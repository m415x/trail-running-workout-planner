import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const sources = readFileSync('lib/competitions/race-registration-course-sources.ts', 'utf8')

describe('course registration sources contract', () => {
  it('loads active athlete names and effective registrations from persistence', () => {
    assert.match(sources, /athleteProfiles/)
    assert.match(sources, /raceRegistrations/)
    assert.match(sources, /registrationStatus/)
    assert.match(sources, /cancelled/)
  })
})
