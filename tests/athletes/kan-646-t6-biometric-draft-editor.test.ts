import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const editorPath = 'features/profile/components/SelfDeclaredBiometricDraftEditor.tsx'
const editor = () => readFileSync(editorPath, 'utf8')
const profile = readFileSync('features/profile/ProfileTab.tsx', 'utf8')
const physiology = readFileSync('features/profile/components/AthleteTabContent.tsx', 'utf8')

test('KAN-646/T6-draft reuses pure validation for exactly four permitted parameters', () => {
  const source = editor()
  assert.match(source, /validateSelfDeclaredBiometric/)
  assert.match(source, /validateSelfDeclaredObservedOn/)
  for (const kind of ['weight', 'height', 'max_hr', 'rest_hr']) {
    assert.match(source, new RegExp(`['"]${kind}['"]`))
  }
  assert.doesNotMatch(source, /vo2max|medical|dni|lactate|training\.coordinate/)
})

test('KAN-646/T6-draft cannot advertise saving or reach production mutations', () => {
  const source = editor()
  assert.doesNotMatch(source, /<form\b|type=['"]submit['"]|\bsave[A-Z]\w*\s*\(|\bpersist\s*\(|\bfetch\s*\(|\buseActionState\b|\bupdateUser\s*\(/)
  assert.doesNotMatch(source, /onClick=\{.*(?:save|submit|persist)/i)
  assert.match(source, /readonly|disabled|draftOnly/)
})

test('KAN-646/T6-draft is not mounted as authorized physiological disclosure before T5', () => {
  assert.doesNotMatch(profile, /SelfDeclaredBiometricDraftEditor/)
  assert.doesNotMatch(physiology, /SelfDeclaredBiometricDraftEditor/)
  assert.match(physiology, /RunningReference/)
})
