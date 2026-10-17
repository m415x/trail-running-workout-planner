import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-646 T6 Profile surfaces biometric authorization/unavailable states instead of hiding the editor silently', () => {
  const page = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')
  const tab = readFileSync('features/profile/components/AthleteTabContent.tsx', 'utf8')
  assert.match(page, /biometricsStatus=\{biometricsResult\.status\}/)
  assert.match(tab, /biometricsStatus/)
  assert.match(tab, /role=['"]status['"]/)
})

test('KAN-646 T6 retry reuses an operation key until the server acknowledges persistence', () => {
  const editor = readFileSync('features/profile/components/BiometricSelfEditor.tsx', 'utf8')
  assert.match(editor, /pendingOperationKeys/)
  assert.match(editor, /operationKey:.*pendingOperationKeys/s)
  assert.match(editor, /crypto\.randomUUID/)
})
