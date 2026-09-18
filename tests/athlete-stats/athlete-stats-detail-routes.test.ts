import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const routes = ['training', 'load', 'adherence', 'competition'] as const

async function routeSource(route: typeof routes[number]) {
  return readFile(`app/[locale]/(mobile)/stats/${route}/page.tsx`, 'utf8')
}

describe('athlete stats detail routes', () => {
  it('provides one athlete-facing route per stats domain', async () => {
    for (const route of routes) {
      const source = await routeSource(route)
      if (route === 'competition') {
        assert.match(source, /getCurrentAthleteRaceRegistrationsAction/)
      } else {
        assert.match(source, /getCurrentAthleteStatsAction/)
        assert.match(source, /view:\s*['"]details['"]/)
      }
      assert.match(source, /\/stats/)
    }
  })

  it('training detail renders factual series and neutral comparisons', async () => {
    const source = await routeSource('training')
    assert.match(source, /series/)
    assert.match(source, /comparison/)
    assert.doesNotMatch(source, /readiness|recommendation|prediction/i)
  })

  it('load detail renders the existing factual trend without readiness semantics', async () => {
    const source = await routeSource('load')
    assert.match(source, /trend/)
    assert.match(source, /coverageRatio/)
    assert.doesNotMatch(source, /readiness|fatigue|risk|recommendation/i)
  })

  it('adherence detail explains confirmed and unknown evidence', async () => {
    const source = await routeSource('adherence')
    assert.match(source, /eligiblePlannedSessions/)
    assert.match(source, /confirmedOutcomeSessions/)
    assert.match(source, /unknownSessions/)
  })

  it('competition detail renders only factual competition context', async () => {
    const source = await routeSource('competition')
    assert.match(source, /raceRegistrationData\.history/)
    assert.doesNotMatch(source, /raceRegistrationData\.upcoming|primaryCompetition|intermediateCompetitions/)
    assert.doesNotMatch(source, /readiness|recommendation|prediction/i)
  })
})
