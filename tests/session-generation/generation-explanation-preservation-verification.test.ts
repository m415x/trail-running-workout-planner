import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const scenarios = fs.readFileSync(
  path.join(root, 'scripts', 'verify-sqlite-scenarios.ts'),
  'utf8',
)
const supabaseVerifier = fs.readFileSync(
  path.join(root, 'db', 'supabase', 'verify.ts'),
  'utf8',
)

test('SQLite preservation scenario keeps legacy generation audit rows and leaves provenance snapshot null', () => {
  const scenario = scenarios.match(
    /function runPreservationScenario[\s\S]*?\n}/,
  )?.[0] ?? ''

  assert.match(scenario, /session_generation_modification_records/)
  assert.match(scenario, /preservation-generation-audit/)
  assert.match(scenario, /generated_created/)
  assert.match(scenario, /preservation-plan/)
  assert.match(scenario, /preservation-session/)
  assert.match(scenario, /preservation-prescription/)
  assert.match(
    scenario,
    /SELECT[\s\S]*generation_explanation[\s\S]*FROM session_generation_modification_records/i,
  )
  assert.match(scenario, /generation_explanation\s*!==\s*null|generation_explanation\s*!==\s*null/i)
  assert.match(
    scenario,
    /did not preserve the representative generation audit|generation audit/i,
  )
})

test('Supabase verifier checks deployed historical generation provenance column shape', () => {
  assert.match(
    supabaseVerifier,
    /table_name\s*=\s*'session_generation_modification_records'/,
  )
  assert.match(supabaseVerifier, /generation_explanation/)
  assert.match(supabaseVerifier, /jsonb/)
  assert.match(supabaseVerifier, /is_nullable/)
  assert.match(supabaseVerifier, /column_default/)
  assert.match(
    supabaseVerifier,
    /Generation explanation provenance contract:[\s\S]*OK[\s\S]*FAIL/,
  )
  assert.match(
    supabaseVerifier,
    /generationExplanationProvenanceValid/,
  )
  assert.match(
    supabaseVerifier,
    /process\.exitCode\s*=\s*1/,
  )
})
