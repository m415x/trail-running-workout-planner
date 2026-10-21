import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const page = readFileSync('app/[locale]/dashboard/planning/new/page.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/planning/coach-planning.json', 'utf8')).CoachPlanning
const en = JSON.parse(readFileSync('messages/en/planning/coach-planning.json', 'utf8')).CoachPlanning

test('KAN-842/T3 New Strategy page uses localized copy for allowed and denied render paths', () => {
  assert.match(page, /getTranslations/)
  assert.match(page, /namespace:\s*['"]CoachPlanning['"]/)
  for (const key of ['back', 'title', 'description', 'noGroupsTitle', 'noGroupsDescription', 'deniedTitle', 'deniedDescription']) {
    assert.match(page, new RegExp(`t\\(['"]newStrategyPage\\.${key}['"]\\)`))
  }
  assert.doesNotMatch(page, />Volver a planificación|>Nueva estrategia de carga|>Configurá el punto de partida/)
})

test('KAN-842/T3 ES and EN provide meaningful New Strategy copy', () => {
  for (const [locale, messages] of [['es', es], ['en', en]] as const) {
    for (const key of ['back', 'title', 'description', 'noGroupsTitle', 'noGroupsDescription', 'deniedTitle', 'deniedDescription']) {
      assert.equal(typeof messages.newStrategyPage?.[key], 'string', `${locale} missing ${key}`)
      assert.ok(messages.newStrategyPage[key].trim(), `${locale} empty ${key}`)
    }
  }
  assert.notEqual(es.newStrategyPage.title, en.newStrategyPage.title)
})
