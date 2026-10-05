import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

const surfaces = [
  'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
  'app/[locale]/dashboard/athletes/[athleteId]/edit/page.tsx',
  'app/[locale]/dashboard/athletes/[athleteId]/goals/new/page.tsx',
  'app/[locale]/dashboard/athletes/[athleteId]/training/page.tsx',
]

test('KAN-623 athlete detail and derived pages use the canonical administrative projection', () => {
  for (const file of surfaces) {
    const value = source(file)
    assert.match(value, /projectAthleteAdministrativeRead/, file)
    assert.doesNotMatch(value, /athlete\.user\.(?:firstName|lastName|email)/, file)
  }
})

test('KAN-623 edit form distinguishes legacy contact display from AthleteProfile contact authority', () => {
  const page = source('app/[locale]/dashboard/athletes/[athleteId]/edit/page.tsx')
  assert.match(page, /email\.source === 'athlete_profile'/)
})

test('KAN-623 list presentation consumes projected administration and tolerates missing User', () => {
  const table = source('features/athletes/components/AthletesTable.tsx')
  assert.match(table, /administrative/)
  assert.doesNotMatch(table, /athlete\.user\.(?:firstName|lastName|email)/)
  assert.match(table, /athlete\.user\?\.avatar/)
})
