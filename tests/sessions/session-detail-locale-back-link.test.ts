import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const detail = readFileSync('app/[locale]/dashboard/sessions/[sessionId]/page.tsx', 'utf8')
const routing = readFileSync('i18n/routing.ts', 'utf8')

test('KAN-577 localized session details use locale-neutral paths with localized Link', () => {
  assert.ok(detail.includes("import { Link } from '@/i18n/routing'"))
  assert.ok(routing.includes('createNavigation'))
  assert.ok(detail.includes("const sessionsPath = '/dashboard/sessions'"))
  assert.ok(!detail.includes("const sessionsPath = locale === 'es'"))
  assert.ok(!detail.includes('${locale}/dashboard/sessions'))
  assert.ok(detail.includes('<Link href={sessionsPath}'))
  assert.ok(detail.includes('href={`${sessionsPath}/${session.id}/edit`}'))
})

test('KAN-577 session detail retains translated back and edit controls', () => {
  assert.ok(detail.includes("t('routes.detail.back')"))
  assert.ok(detail.includes("t('routes.detail.edit')"))
  assert.ok(detail.includes('formatDate(session.date, locale)'))
})
