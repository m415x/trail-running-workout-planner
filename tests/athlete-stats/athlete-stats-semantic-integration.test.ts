import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadMessages } from '@/i18n/messages'
import { projectAthleteStatsDetails, projectAthleteStatsSummary } from '@/lib/athlete-stats/athlete-stats-projections'
import { athleteStatsSemanticFixture } from '@/tests/fixtures/athlete-stats-semantic.fixture'

describe('athlete stats semantic integration', () => {
  it('preserves known zero, unknown, insufficient and missing previous-period semantics end to end', () => {
    const summary = projectAthleteStatsSummary(athleteStatsSemanticFixture)
    const details = projectAthleteStatsDetails(athleteStatsSemanticFixture)

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
    const summary = projectAthleteStatsSummary(athleteStatsSemanticFixture)
    const details = projectAthleteStatsDetails(athleteStatsSemanticFixture)

    assert.equal(summary.competition, null)
    assert.deepEqual(details.competition, { primaryCompetition: null, intermediateCompetitions: [] })
  })

  it('keeps coach-only disclosure and interpretation out of athlete projections', () => {
    const serialized = JSON.stringify(projectAthleteStatsDetails(athleteStatsSemanticFixture))
    assert.doesNotMatch(serialized, /coach|readiness|recommendation|risk|fatigue/i)
  })

  it('keeps ES and EN Stats structures equivalent and athlete wording non-interpretive', async () => {
    const [es, en] = await Promise.all([loadMessages('es'), loadMessages('en')])
    const esStats = (es as Record<string, unknown>).stats
    const enStats = (en as Record<string, unknown>).stats

    assert.ok(esStats, 'expected ES stats messages to be registered')
    assert.ok(enStats, 'expected EN stats messages to be registered')
    assert.deepEqual(Object.keys(esStats as object).sort(), Object.keys(enStats as object).sort())
    assert.doesNotMatch(JSON.stringify(esStats), /readiness|fatiga|riesgo|recomend/i)
    assert.doesNotMatch(JSON.stringify(enStats), /readiness|fatigue|risk|recommend/i)
  })
})
