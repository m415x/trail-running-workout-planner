import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const schema = fs.readFileSync(path.join(root, 'db', 'schema.ts'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'drizzle', 'sqlite', '0008_membership_billing_foundation.sql'),
  'utf8',
)

test('H1 monthly charge persistence leaves zero amount due available for H2 full reductions', () => {
  assert.match(
    schema,
    /baseAmountMinor[^\n]*integer\(['"]base_amount_minor['"]\)\.notNull\(\)/,
  )
  assert.match(
    schema,
    /amountDueMinor[^\n]*integer\(['"]amount_due_minor['"]\)\.notNull\(\)/,
  )
  assert.match(
    schema,
    /baseAmountMinor}\s*>\s*0[\s\S]*amountDueMinor}\s*>=\s*0/,
  )

  assert.match(migration, /"base_amount_minor"\s*>\s*0/i)
  assert.match(migration, /"amount_due_minor"\s*>=\s*0/i)
  assert.doesNotMatch(migration, /"amount_due_minor"\s*>\s*0/i)
})
