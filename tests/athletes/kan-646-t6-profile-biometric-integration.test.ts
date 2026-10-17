import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646 T6 Athlete Profile exposes four SELF biometric inputs and authorized persistence', () => {
  const tab = readFileSync('features/profile/components/AthleteTabContent.tsx', 'utf8')
  const page = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')
  assert.match(tab, /BiometricSelfEditor/, 'Physiology tab must include a real biometric editor')
  assert.match(tab, /biometrics/, 'editor must receive persisted SELF state rather than mock data')
  assert.match(page, /readCurrent.*Biometric/, 'Profile server page must load authorized biometric state')
  const editor = readFileSync('features/profile/components/BiometricSelfEditor.tsx', 'utf8')
  for (const kind of ['weight', 'height', 'max_hr', 'rest_hr']) {
    assert.ok(editor.includes(kind), 'missing editable physiological parameter: ' + kind)
  }
  assert.match(editor, /observedOn/, 'the athlete must see/edit observation date')
  assert.match(editor, /operationKey/, 'writes must carry an idempotency operation key')
  assert.doesNotMatch(editor, /currentUser|data\.ts/, 'mock account cannot be an authority')
})
