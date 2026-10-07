import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const loginPage = readFileSync('app/[locale]/login/page.tsx', 'utf8')
const loginForm = readFileSync('app/[locale]/login/LoginForm.tsx', 'utf8')
const recoveryPage = readFileSync('app/[locale]/auth/recovery/page.tsx', 'utf8')
const recoveryForm = readFileSync('app/[locale]/auth/recovery/RecoveryRequestForm.tsx', 'utf8')
const resetPage = readFileSync('app/[locale]/auth/recovery/reset/page.tsx', 'utf8')
const resetForm = readFileSync('app/[locale]/auth/recovery/reset/RecoveryResetForm.tsx', 'utf8')
const fragments = readFileSync('i18n/message-fragments.ts', 'utf8')
const loader = readFileSync('i18n/messages.ts', 'utf8')
const es = JSON.parse(readFileSync('messages/es/auth/recovery.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en/auth/recovery.json', 'utf8'))

test('KAN-640 login exposes localized forgot-password navigation and updated confirmation', () => {
  assert.match(loginForm, /auth\/recovery/)
  assert.match(loginPage, /recovery/)
  assert.match(loginPage, /updated/)
})

test('KAN-640 recovery request page is localized and wired to the non-enumerative action', () => {
  assert.match(recoveryPage, /RecoveryRequestForm/)
  assert.match(recoveryPage, /recovery_invalid/)
  assert.match(recoveryForm, /requestPasswordRecoveryAction/)
  assert.match(recoveryForm, /name=['"]email['"]/)
  assert.match(recoveryForm, /name=['"]locale['"]/)
  assert.match(recoveryForm, /accepted/)
})

test('KAN-640 reset page is localized and wired to the password update action', () => {
  assert.match(resetPage, /RecoveryResetForm/)
  assert.match(resetForm, /completePasswordRecoveryAction/)
  assert.match(resetForm, /name=['"]password['"]/)
  assert.match(resetForm, /name=['"]locale['"]/)
  assert.match(resetForm, /invalid/)
})

test('KAN-640 recovery messages are registered for es and en', () => {
  assert.match(fragments, /auth\/recovery/)
  assert.match(loader, /messages\/en\/auth\/recovery\.json/)
  assert.match(loader, /messages\/es\/auth\/recovery\.json/)

  for (const key of [
    'requestTitle',
    'requestDescription',
    'accepted',
    'invalidLink',
    'resetTitle',
    'resetDescription',
    'invalidReset',
    'backToLogin',
  ]) {
    assert.equal(typeof es.Recovery[key], 'string')
    assert.equal(typeof en.Recovery[key], 'string')
    assert.notEqual(es.Recovery[key], en.Recovery[key])
  }
})

test('KAN-640 recovery copy remains non-enumerative and does not promise EPT access', () => {
  const copy = JSON.stringify({ es, en })

  assert.doesNotMatch(copy, /email.*(exists|does not exist|existe|no existe)/i)
  assert.doesNotMatch(copy, /access granted|acceso concedido|externalidentitylink|dni/i)
})
