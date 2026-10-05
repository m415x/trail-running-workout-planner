import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

test('KAN-623 athlete listing projects administrative facts without requiring User', () => {
  const action = source('app/actions/athlete-actions.ts')
  const table = source('features/athletes/components/AthletesTable.tsx')

  assert.match(action, /projectAthleteAdministrativeRead/)
  assert.doesNotMatch(action, /first\.user\.(?:firstName|lastName)|second\.user\.(?:firstName|lastName)/)
  assert.match(table, /administrative/)
  assert.doesNotMatch(table, /athlete\.user\.(?:firstName|lastName|email)/)
})

test('KAN-623 athlete edit prefill uses the shared read model, not a required User join', () => {
  const page = source('app/[locale]/dashboard/athletes/[athleteId]/edit/page.tsx')

  assert.match(page, /projectAthleteAdministrativeRead/)
  assert.doesNotMatch(page, /athlete\.user\.(?:firstName|lastName|email)/)
})
