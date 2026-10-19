import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync('features/profile/components/BiometricSelfEditor.tsx', 'utf8')

test('KAN-815/A2 active SELF biometric form normalizes draft before authorized actions', () => {
  assert.match(form, /import\s*\{\s*normalizeBiometricDraftValue\s*\}\s*from\s*['"]@\/lib\/numeric\/biometric-draft-normalization['"]/)
  assert.match(form, /normalizeBiometricDraftValue\(draft\.value,\s*parameter\.kind\)/)
  assert.match(form, /value:\s*normalizedValue/)
  assert.match(form, /if\s*\(normalizedValue\s*===\s*null\)/)
})

test('KAN-815/A2 preserves existing action authority and correct-vs-create selection', () => {
  assert.match(form, /correctCurrentSelfBiometricAction/)
  assert.match(form, /createCurrentSelfBiometricAction/)
  assert.match(form, /supersedesObservationId:\s*current\.id/)
  assert.match(form, /operationKey:\s*pendingOperationKeys\.current\[parameter\.kind\]\.key/)
})

test('KAN-815/A2 uses numeric inputMode according to biometric quantity', () => {
  assert.match(form, /inputMode=\{parameter\.scale\s*===\s*1\s*\?\s*['"]numeric['"]\s*:\s*['"]decimal['"]\}/)
})
