import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 H6 exception callbacks forward verified authorship to all three runtime mutations', () => {
  const source = readFileSync('app/actions/membership-actions.ts', 'utf8')
  const start = source.indexOf('const authorizedEconomicExceptions = createH6EconomicExceptionActions(')
  const end = source.indexOf('export async function applyGlobalDueDateExceptionAction', start)
  assert.ok(start >= 0 && end > start)
  const boundary = source.slice(start, end)
  assert.match(boundary, /globalDueDate:\s*\(teamId, input, authorship\)\s*=>\s*runtime\.applyGlobalDueDateException\(\{\s*\.\.\.input, teamId, authorship\s*\}\)/)
  assert.match(boundary, /reduce:\s*\(teamId, input, authorship\)\s*=>/)
  assert.match(boundary, /runtime\.applyMonthlyChargeReduction\(\{[\s\S]*?authorship,[\s\S]*?\}\)/)
  assert.match(boundary, /extend:\s*\(teamId, input, authorship\)\s*=>/)
  assert.match(boundary, /runtime\.applyMonthlyChargeExtension\(\{[\s\S]*?authorship,[\s\S]*?\}\)/)
})
