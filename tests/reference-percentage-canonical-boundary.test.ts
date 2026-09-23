import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

test('KAN-412 canonical intensity type does not expose the legacy PAM percentage contract', () => {
  const types = source('types/training/intensity.types.ts')
  assert.match(types, /export type IntensityMethod = 'hr_zone' \| 'reference_percentage'/)
  assert.match(types, /method: 'reference_percentage'\s+referencePercentage: ReferencePercentage/)
  assert.doesNotMatch(types, /method: 'pam_percentage'|pamPercentage: PamPercentage/)
})

test('KAN-412 SQLite and Supabase workout and session schemas use reference percentage', () => {
  for (const file of ['db/schema.ts', 'db/supabase/schema.ts']) {
    const schema = source(file)
    assert.match(schema, /referencePercentage: (?:real|doublePrecision)\('reference_percentage'\)/, file)
    assert.doesNotMatch(schema, /pamPercentage: (?:real|doublePrecision)\('pam_percentage'\)/, file)
  }
})
