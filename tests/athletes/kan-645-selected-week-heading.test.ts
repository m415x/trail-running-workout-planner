import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-645/T8 selected-week heading distinguishes current and navigated civil weeks in ES/EN', () => {
  const page = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
  const es = JSON.parse(readFileSync('messages/es/athletes/plan.json', 'utf8')).AthletePlan
  const en = JSON.parse(readFileSync('messages/en/athletes/plan.json', 'utf8')).AthletePlan
  assert.equal(es.currentWeek, 'Semana actual')
  assert.equal(es.selectedWeek, 'Semana seleccionada')
  assert.equal(en.currentWeek, 'Current week')
  assert.equal(en.selectedWeek, 'Selected week')
  assert.match(page, /monday === currentWeekMonday\s*\?\s*t\('currentWeek'\)\s*:\s*t\('selectedWeek'\)/)
  assert.match(page, /const currentWeekMonday = currentWeek\.status === 'resolved'/)
})
