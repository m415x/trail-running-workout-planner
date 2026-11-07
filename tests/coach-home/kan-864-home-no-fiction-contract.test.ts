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

test('KAN-864 T1: Home offers only destinations projected by authenticated Coach layout', () => {
  const layout = readFileSync('app/[locale]/dashboard/layout.tsx', 'utf8')
  const context = readFileSync('features/coach-home/coach-home-destinations.tsx', 'utf8')
  assert.match(layout, /createCoachNavigationNextServerProjection/)
  assert.match(layout, /visibleDestinations=\{visibleDestinations\}/)
  assert.match(shell, /CoachHomeDestinationsContext\.Provider value=\{visibleDestinations\}/)
  assert.match(context, /createContext<readonly string\[\]>/)
  assert.match(page, /useCoachHomeDestinations\(\)/)
  assert.match(page, /selectCoachSidebarDestinations\(visibleDestinations\)/)
  assert.match(page, /const links = WORK_AREAS\.filter\(\(area\) => destinations\.has\(area\.href\)\)/)
  assert.match(page, /<Link/)
  assert.match(page, /links\.length === 0/)
  assert.doesNotMatch(page, /\bteam_1\b|\bCURRENT_TEAM_ID\b/)
})
