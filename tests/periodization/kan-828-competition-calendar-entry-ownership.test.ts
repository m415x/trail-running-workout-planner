import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actions = readFileSync(
  path.join(process.cwd(), 'app/actions/competition-calendar-actions.ts'),
  'utf8',
)
const service = readFileSync(
  path.join(process.cwd(), 'lib/periodization/competition-calendar-service.ts'),
  'utf8',
)

function actionBody(name: string, nextName: string) {
  const start = actions.indexOf(`export async function ${name}(`)
  const end = actions.indexOf(`export async function ${nextName}(`, start + 1)
  assert.ok(start >= 0 && end > start, `expected distinct ${name} action region`)
  return actions.slice(start, end)
}

test('KAN-828 T2 RED: mutation adapters prove Entry belongs to authorized Plan before calling mutation service', () => {
  const direct = [
    ['updateCompetitionAction', 'rescheduleCompetitionAction'],
    ['rescheduleCompetitionAction', 'changeCompetitionStatusAction'],
    ['changeCompetitionStatusAction', 'createCompetitionFromCatalogAction'],
  ] as const

  for (const [name, next] of direct) {
    const body = actionBody(name, next)
    assert.match(
      body,
      /requireAuthorizedCompetitionEntry\s*\(/,
      `${name} must explicitly resolve authorized Plan→Entry ownership before mutation`,
    )
  }
})

test('KAN-828 T2 preexisting domain service denies cross-Plan update, reschedule and status', () => {
  for (const name of ['updateCompetition', 'rescheduleCompetition', 'changeCompetitionStatus']) {
    const start = service.indexOf(`export function ${name}(`)
    assert.ok(start >= 0, `missing ${name}`)
    assert.match(
      service.slice(start, start + 900),
      /existing\.groupTrainingPlanId !== input\.planId/,
      `${name} must retain its own service-level Plan mismatch guard`,
    )
  }
})
