import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-821/T9a Profile tab labels consume an Athlete responsive preference token', () => {
  const profile = read('features/profile/ProfileTab.tsx')
  assert.match(profile, /<TabsTrigger[^>]*value='athlete'[^>]*text-\[length:var\(--athlete-text-label\)\]/)
  assert.match(profile, /<TabsTrigger[^>]*value='settings'[^>]*text-\[length:var\(--athlete-text-label\)\]/)
  assert.match(profile, /<TabsList[^>]*grid-cols-2/)
  assert.match(profile, /<SettingsTabContent\s*\/>/)
})

test('KAN-821/T9a Settings typography and account labels respond to selected Athlete preset', () => {
  const settings = read('features/profile/components/SettingsTabContent.tsx')
  for (const role of ['label', 'body', 'title']) {
    assert.match(settings, new RegExp('text-\\[length:var\\(--athlete-text-' + role + '\\)\\]'), `Settings missing semantic ${role} typography`)
  }
  assert.match(settings, /ATHLETE_TYPOGRAPHY_PRESETS/)
  assert.match(settings, /useAthleteTypography/)
  assert.match(settings, /<fieldset\b/)
  assert.match(settings, /<legend\b/)
  assert.match(settings, /type='radio'/)
  assert.match(settings, /min-h-11/)
  assert.match(settings, /focus-visible:/)
  assert.match(settings, /ThemeToggleButton/)
  assert.match(settings, /completeLogoutNavigation/)
  assert.match(settings, /auth\/recovery/)
  assert.match(settings, /logoutAction/)
  assert.match(settings, /signOutError/)
})
