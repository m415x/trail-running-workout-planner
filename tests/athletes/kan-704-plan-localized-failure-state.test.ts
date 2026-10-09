import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actionSource = readFileSync('app/actions/dashboard-actions.ts', 'utf8')
const planSource = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
const homeSource = readFileSync('features/workouts/HomeTab.tsx', 'utf8')

function planningWeekBody() {
  const start = actionSource.indexOf('export async function getCurrentAthletePlanningWeek(')
  const end = actionSource.indexOf('export async function getAthleteShoes(', start)
  assert.ok(start >= 0 && end > start)
  return actionSource.slice(start, end)
}

test('KAN-704 T8.2 week action returns stable unauthorized/error codes rather than translated human strings', () => {
  const body = planningWeekBody()
  assert.match(body, /success:\s*false\s+as\s+const,\s*status:\s*['"]unauthorized['"]/)
  assert.match(body, /success:\s*false\s*,\s*status:\s*['"]error['"]/)
  assert.doesNotMatch(body, /error:\s*['"]Acceso no autorizado['"]/)
  assert.doesNotMatch(body, /error:\s*['"]No se pudo cargar la planificación de la semana['"]/)
})

test('KAN-704 T8.2 Plan uses next-intl keys for DENY and unexpected failures, not action messages', () => {
  assert.match(planSource, /result\.status\s*===\s*['"]unauthorized['"]/)
  assert.match(planSource, /t\(['"]unauthorized['"]\)/)
  assert.match(planSource, /t\(['"]loadError['"]\)/)
  assert.doesNotMatch(planSource, /result\.error\s*\?\?/)
  assert.doesNotMatch(planSource, /result\.error\s*===\s*['"]Acceso no autorizado['"]/)
})

test('KAN-704 T8.2 Home week callback recognizes semantic DENY, without comparing Spanish text', () => {
  assert.match(homeSource, /result\.status\s*===\s*['"]unauthorized['"]/)
  assert.doesNotMatch(homeSource, /result\.error\s*===\s*['"]Acceso no autorizado['"]/)
})
