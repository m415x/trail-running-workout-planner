import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sidebar = readFileSync('components/dashboard/app-sidebar.tsx', 'utf8')

test('KAN-693 Coach sidebar renders only policy-approved server destinations', () => {
  assert.match(sidebar, /selectCoachSidebarDestinations\(visibleDestinations\)/)
  assert.match(sidebar, /allowedDestinations\.includes\(item\.href\)/)
  assert.doesNotMatch(sidebar, /navigationItems\.map\(/)
})

test('KAN-693 Coach navigation retains locale labels and accessible region name', () => {
  assert.match(sidebar, /useTranslations\('CoachShell'\)/)
  assert.match(sidebar, /t\(`navigation\.\$\{item\.labelKey\}`\)/)
  assert.match(sidebar, /aria-label=\{t\('management'\)\}/)
})

test('KAN-693 Coach links preserve keyboard-native links, dirty-form guard and mobile close', () => {
  assert.match(sidebar, /<Link\s+href=\{item\.href\}/)
  assert.match(sidebar, /guardNavigation\(\(\) => \{/)
  assert.match(sidebar, /setOpenMobile\(false\)/)
})
