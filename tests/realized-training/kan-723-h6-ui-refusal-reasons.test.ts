import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const dialog = read('features/workouts/components/LogWorkoutDialog.tsx')
const hook = read('features/workouts/hooks/useLogWorkoutDialog.ts')
const workoutHook = read('features/workouts/hooks/useWorkoutCard.ts')
const workoutCard = read('features/workouts/components/WorkoutCard.tsx')
const es = JSON.parse(read('messages/es/realized-training/workouts.json')).Workouts.dialog
const en = JSON.parse(read('messages/en/realized-training/workouts.json')).Workouts.dialog

test('KAN-723 manual capture and correction preserve known H6 DENY cause through onSave', () => {
  assert.match(workoutHook, /blocked_for_prior_debt/)
  assert.match(workoutHook, /economic_evidence_unavailable/)
  assert.match(workoutCard, /blocked_for_prior_debt/)
  assert.match(workoutCard, /economic_evidence_unavailable/)
  assert.match(hook, /blocked_for_prior_debt/)
  assert.match(hook, /economic_evidence_unavailable/)
  assert.match(dialog, /dialog\.\$\{saveError\}/)
})

test('KAN-723 debt and economic evidence errors are localized distinctly and without blame on unavailable', () => {
  for (const messages of [es, en]) {
    assert.ok(messages.blockedForPriorDebt?.length > 20)
    assert.ok(messages.economicEvidenceUnavailable?.length > 20)
    assert.notEqual(messages.blockedForPriorDebt, messages.economicEvidenceUnavailable)
  }
  assert.match(es.blockedForPriorDebt, /cuota|deuda/i)
  assert.doesNotMatch(es.economicEvidenceUnavailable, /deuda|moros|vencid/i)
  assert.doesNotMatch(en.economicEvidenceUnavailable, /debt|overdue|unpaid/i)
})

test('KAN-723 known refusal leaves entered values intact for retry or regularization', () => {
  assert.match(hook, /if \(!saved\)/)
  assert.doesNotMatch(hook, /if \(!saved\)[\s\S]{0,110}resetForm\(/)
  assert.match(hook, /setSaveError/)
})
