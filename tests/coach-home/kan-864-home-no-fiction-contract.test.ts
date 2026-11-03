import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/[locale]/dashboard/page.tsx', 'utf8')
const shell = readFileSync('app/[locale]/dashboard/DashboardShell.tsx', 'utf8')

test('KAN-864 T1: Coach Home does not present hardcoded business figures as live data', () => {
  for (const fixed of [
    />24</, />8</, />\$1,250</, />3</,
    /\+2 desde el mes pasado/,
    /85% de membresías al día/,
    /3 atletas requieren seguimiento/,
    /Atletas con sobrecarga reportada/,
    /pendiente de implementar/,
  ]) {
    assert.doesNotMatch(page, fixed, `Static business data or placeholder must be removed: ${fixed}`)
  }
})

test('KAN-864 T1: Coach shell must not show an invented identity', () => {
  assert.doesNotMatch(shell, /Coach Name|coach@trailrun\.com|\/avatars\/coach\.png/,
    'Coach identity must be authenticated or omitted; no fake name, email or image')
})

test('KAN-864 T1: Home headings must be localized in ES/EN', () => {
  assert.match(page, /getTranslations|useTranslations/,
    'Coach Home needs server or client next-intl translations')
  assert.doesNotMatch(page, />Resumen General</,
    'Spanish literals must not be embedded into the locale-neutral component')
})

test('KAN-864 T1: Home has real navigation and distinct unavailable-state semantics', () => {
  assert.match(page, /\bLink\b/, 'Home must provide navigable canonical Coach destinations')
  assert.match(page, /denied|selection_required|invalid_context/,
    'An authorization failure must not be rendered as an empty team')
  assert.match(page, /empty|status === 'ready'|status: 'ready'/,
    'Authorized no-data state must not be replaced by hardcoded business metrics')
})
