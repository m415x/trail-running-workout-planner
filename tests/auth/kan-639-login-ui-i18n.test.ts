import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/[locale]/login/page.tsx', 'utf8')
const form = readFileSync('app/[locale]/login/LoginForm.tsx', 'utf8')
const fragments = readFileSync('i18n/message-fragments.ts', 'utf8')
const messagesLoader = readFileSync('i18n/messages.ts', 'utf8')
const es = JSON.parse(readFileSync('messages/es/auth/login.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en/auth/login.json', 'utf8'))

test('KAN-639 exposes a localized login route and form', () => {
  assert.match(page, /LoginForm/)
  assert.match(page, /locale/)
  assert.match(form, /useActionState/)
  assert.match(form, /loginAction/)
  assert.match(form, /name=['"]email['"]/)
  assert.match(form, /name=['"]password['"]/)
  assert.match(form, /name=['"]locale['"]/)
  assert.match(form, /name=['"]returnTo['"]/)
})

test('KAN-639 login UI renders explicit localized outcomes without exposing identity details', () => {
  for (const key of ['invalidCredentials', 'unlinked', 'invalid']) {
    assert.equal(typeof es.Login[key], 'string')
    assert.equal(typeof en.Login[key], 'string')
    assert.notEqual(es.Login[key], en.Login[key])
  }

  assert.doesNotMatch(JSON.stringify(es), /subject|provider|uuid/i)
  assert.doesNotMatch(JSON.stringify(en), /subject|provider|uuid/i)
})

test('KAN-639 login messages are registered as an i18n fragment for both locales', () => {
  assert.match(fragments, /auth\/login/)
  assert.match(messagesLoader, /messages\/en\/auth\/login\.json/)
  assert.match(messagesLoader, /messages\/es\/auth\/login\.json/)
})

test('KAN-639 login page preserves returnTo from search params for the server action', () => {
  assert.match(page, /searchParams/)
  assert.match(page, /returnTo/)
  assert.match(page, /<LoginForm/)
})
