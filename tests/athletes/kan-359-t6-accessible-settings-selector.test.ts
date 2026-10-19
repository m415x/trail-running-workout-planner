import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-359/T6 Athlete Settings exposes a labeled, keyboard-operable typography preference', () => {
  const settings = read('features/profile/components/SettingsTabContent.tsx')
  assert.match(settings, /useAthleteTypography/)
  assert.match(settings, /<fieldset\b/)
  assert.match(settings, /<legend\b/)
  assert.match(settings, /ATHLETE_TYPOGRAPHY_PRESETS/)
  assert.match(settings, /type=['"]radio['"]/)
  assert.match(settings, /checked=\{/)
  assert.match(settings, /onChange=\{/)
  assert.match(settings, /setPreference\(/)
  assert.match(settings, /min-h-11/)
  assert.match(settings, /focus-visible:/)
})

test('KAN-359/T6 typography choices are translated in both Athlete Settings locales', () => {
  for (const locale of ['es', 'en']) {
    const messages = JSON.parse(read(`messages/${locale}/athletes/profile.json`)) as {
      AthleteProfile: { settings: { accessibility?: Record<string, unknown> } }
    }
    const accessibility = messages.AthleteProfile.settings.accessibility
    assert.ok(accessibility, `${locale}: accessibility label required`)
    for (const key of ['title', 'fontSize', 'compact', 'standard', 'large', 'extraLarge']) {
      assert.equal(typeof accessibility[key], 'string', `${locale}: missing ${key}`)
      assert.ok((accessibility[key] as string).trim().length > 0)
    }
  }
})

test('KAN-359/T6 retains existing KAN-646 account and theme controls', () => {
  const settings = read('features/profile/components/SettingsTabContent.tsx')
  assert.match(settings, /ThemeToggleButton/)
  assert.match(settings, /completeLogoutNavigation/)
  assert.match(settings, /logoutAction/)
  assert.match(settings, /auth\/recovery/)
  assert.match(settings, /signOutError/)
})
