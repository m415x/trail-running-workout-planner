import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import { buildAthleteStatsDetails, buildAthleteStatsSummary } from '@/lib/athlete-stats/athlete-stats-projections'
import { athleteStatsSemanticFixture } from '@/tests/fixtures/athlete-stats-semantic.fixture'

describe('athlete stats semantic integration', () => {
  it('preserves known zero, unknown, insufficient and missing previous-period semantics end to end', () => {
    const summary = buildAthleteStatsSummary(athleteStatsSemanticFixture)
    const details = buildAthleteStatsDetails(athleteStatsSemanticFixture)

    assert.equal(summary.training.frequency.value, 0)
    assert.equal(summary.training.distance.value, null)
    assert.equal(summary.training.distance.state, 'unknown')
    assert.equal(summary.training.distance.comparison.state, 'not_evaluable')
    assert.equal(summary.load.state, 'insufficient_data')
    assert.equal(summary.adherence.state, 'insufficient_data')

    assert.equal(details.training.frequency.value, 0)
    assert.equal(details.training.distance.value, null)
    assert.equal(details.training.distance.comparison.state, 'not_evaluable')
  })

  it('preserves empty competition as successful athlete data rather than an error', () => {
    const summary = buildAthleteStatsSummary(athleteStatsSemanticFixture)
    const details = buildAthleteStatsDetails(athleteStatsSemanticFixture)

    assert.equal(summary.competition, null)
    assert.deepEqual(details.competition, {
      primaryCompetition: null,
      intermediateCompetitions: [],
    })
  })

  it('keeps coach-only disclosure and interpretation out of athlete projections', () => {
    const details = buildAthleteStatsDetails(athleteStatsSemanticFixture)
    const serialized = JSON.stringify(details)

    assert.doesNotMatch(serialized, /coach|readiness|recommendation|risk|fatigue/i)
  })

  it('keeps ES and EN Stats structures equivalent and athlete wording non-interpretive', async () => {
    const [esRaw, enRaw] = await Promise.all([
      readFile('messages/es.json', 'utf8'),
      readFile('messages/en.json', 'utf8'),
    ])
    const es = JSON.parse(esRaw)
    const en = JSON.parse(enRaw)

    assert.deepEqual(Object.keys(es.stats).sort(), Object.keys(en.stats).sort())
    assert.doesNotMatch(JSON.stringify(es.stats), /readiness|fatiga|riesgo|recomend/i)
    assert.doesNotMatch(JSON.stringify(en.stats), /readiness|fatigue|risk|recommend/i)
  })
})
