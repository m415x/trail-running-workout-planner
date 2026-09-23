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

test('KAN-412 plan-real comparison exposes reference percentage without PAM unit aliases', () => {
  const types = source('types/training/plan-real-comparison.types.ts')
  const presentation = source('features/athletes/components/PlanRealComparison.tsx')
  const actions = source('app/actions/realized-training-actions.ts')
  assert.match(types, /'reference_percent'/)
  assert.doesNotMatch(types, /'pam_percent'/)
  assert.match(presentation, /reference_percent: '% of reference'/)
  assert.match(presentation, /reference_percent: '% de referencia'/)
  assert.doesNotMatch(presentation, /pam_percent|% PAM/)
  assert.match(actions, /unit: 'reference_percent'/)
  assert.doesNotMatch(actions, /unit: 'pam_percent'/)
})

test('KAN-412 removes the temporary legacy percentage classifier', () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), 'lib/physiology/reference-percentage-compatibility.ts')), false)
  assert.equal(fs.existsSync(path.join(process.cwd(), 'tests/physiology/reference-percentage-compatibility.test.ts')), false)
})

test('KAN-446 excludes unsupported zone-to-PAM mappings and retains workout type PAM', () => {
  const constants = source('lib/constants.ts')
  const workoutCard = source('features/workouts/hooks/useWorkoutCard.ts')
  assert.equal(fs.existsSync(path.join(process.cwd(), 'lib/physiology/pam.ts')), false)
  assert.doesNotMatch(constants, /ZONE_PAM_PERCENTAGES/)
  assert.match(constants, /PAM: \{ icon: PamIcon \}/)
  assert.doesNotMatch(workoutCard, /getZonePaceRangeFromPam|ZONE_PAM_PERCENTAGES|physiology\/pam/)
  assert.match(workoutCard, /resolveExecutionGuidance/)
})

test('KAN-444 remote verifier checks reference-percentage schema and persisted legacy values', () => {
  const verifier = source('db/supabase/verify.ts')
  for (const name of [
    'reference_percentage_target',
    'reference_percentage',
    'pam_percentage_target',
    'pam_percentage',
    'pamPercentageTarget',
    'intensity_strategies.default_method',
    'group_session_prescriptions.intensity_method',
    'workouts.intensity_method',
  ]) {
    assert.ok(verifier.includes(name), `remote verifier must check ${name}`)
  }
  assert.match(verifier, /!intensityContractValid/)
  assert.match(verifier, /Reference percentage contract:/)
})
