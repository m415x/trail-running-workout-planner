import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync('app/[locale]/(mobile)/stats/competition/page.tsx', 'utf8')
const es = readFileSync('messages/es/athlete-stats/stats.json', 'utf8')
const en = readFileSync('messages/en/athlete-stats/stats.json', 'utf8')

describe('Athlete Stats race history i18n', () => {
  it('keeps all new registration/history presentation copy behind Stats translations', () => {
    assert.doesNotMatch(page, /Próximas inscripciones|Historial de carreras|Participación:|Distancia real:|Tiempo:|No hay inscripciones próximas|No hay participaciones históricas registradas/)
    assert.doesNotMatch(page, /t\('competitionDetail\.registrations\.upcoming'\)/)
    assert.match(page, /t\('competitionDetail\.registrations\.history'\)/)
    assert.match(page, /t\('competitionDetail\.registrations\.unknown'\)/)
  })

  it('defines the same athlete-safe registration keys in ES and EN', () => {
    for (const source of [es, en]) {
      assert.match(source, /"registrations"/)
      assert.match(source, /"upcoming"/)
      assert.match(source, /"history"/)
      assert.match(source, /"participation"/)
      assert.match(source, /"actualDistance"/)
      assert.match(source, /"elapsedTime"/)
      assert.match(source, /"unknown"/)
      assert.match(source, /"participationStatuses"/)
      for (const status of ['unknown', 'started', 'finished', 'dnf', 'dns']) {
        assert.match(source, new RegExp(`"${status}"`))
      }
    }
  })
})
