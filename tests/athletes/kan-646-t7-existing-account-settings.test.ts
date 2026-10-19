import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const settings = readFileSync('features/profile/components/SettingsTabContent.tsx', 'utf8')
const auth = readFileSync('app/actions/auth-actions.ts', 'utf8')
const navigation = readFileSync('lib/auth/logout-navigation.ts', 'utf8')

test('KAN-646/T7 Settings reuses existing theme, recovery and sign-out boundaries', () => {
  assert.match(settings, /ThemeToggleButton/)
  assert.match(settings, /useLocale/)
  assert.match(settings, /logoutAction/)
  assert.match(settings, /completeLogoutNavigation/)
  assert.match(settings, /auth\/recovery/)
  assert.match(settings, /useRouter/)
})

test('KAN-646/T7 Settings does not create a new password writer or invalid client authority', () => {
  assert.doesNotMatch(settings, /updateUser\(|athleteProfileId|teamId|userId|physiology\.biometric/)
  assert.match(auth, /export async function logoutAction/)
  assert.match(auth, /await context\.clear\(\)/)
  assert.match(navigation, /replace\(`\/\$\{input\.locale\}\/login`\)/)
})

test('KAN-646/T7 Settings uses localized labels and an explicit logout failure state', () => {
  assert.match(settings, /useTranslations\('AthleteProfile\.settings'\)/)
  assert.match(settings, /logoutFailed/)
  for (const locale of ['es', 'en']) {
    const messages = JSON.parse(readFileSync(`messages/${locale}/athletes/profile.json`, 'utf8'))
    for (const key of ['theme', 'changeTheme', 'passwordRecovery', 'signOut', 'signOutError']) {
      assert.equal(typeof messages.AthleteProfile.settings[key], 'string')
      assert.ok(messages.AthleteProfile.settings[key].trim().length > 0)
    }
  }
})
