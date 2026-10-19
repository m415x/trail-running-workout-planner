import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBiometricDraftValue } from '@/lib/numeric/biometric-draft-normalization'
import { validateSelfDeclaredBiometric } from '@/lib/physiology/self-declared-biometric-validation'

test('KAN-815/A2 normalizes comma decimals into existing biometric validator input', () => {
  assert.equal(normalizeBiometricDraftValue('70,5', 'weight'), '70.5')
  assert.equal(normalizeBiometricDraftValue('170,5', 'height'), '170.5')
  const canonical = normalizeBiometricDraftValue('70,5', 'weight')
  assert.equal(validateSelfDeclaredBiometric({ kind: 'weight', unit: 'kg', value: canonical ?? '' }).status, 'valid')
})

test('KAN-815/A2 preserves strict physiology precision and integer semantics', () => {
  assert.equal(normalizeBiometricDraftValue('70,55', 'weight'), null)
  assert.equal(normalizeBiometricDraftValue('150,5', 'max_hr'), null)
  assert.equal(normalizeBiometricDraftValue('150', 'max_hr'), '150')
  assert.equal(normalizeBiometricDraftValue('1.234,5', 'weight'), null)
  assert.equal(normalizeBiometricDraftValue('70,', 'weight'), null)
  assert.equal(normalizeBiometricDraftValue('', 'weight'), null)
})

test('KAN-815/A2 leaves physiological domain bounds to existing validator', () => {
  const canonical = normalizeBiometricDraftValue('5,0', 'weight')
  assert.equal(canonical, '5.0')
  assert.equal(validateSelfDeclaredBiometric({ kind: 'weight', unit: 'kg', value: canonical ?? '' }).status, 'invalid')
})
