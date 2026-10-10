import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stats = readFileSync('app/[locale]/(mobile)/stats/page.tsx','utf8')
const profile = readFileSync('features/profile/components/AthleteTabContent.tsx','utf8')
const profilePage = readFileSync('app/[locale]/(mobile)/profile/page.tsx','utf8')
const localeEs = JSON.parse(readFileSync('messages/es/athletes/profile.json','utf8'))
const localeEn = JSON.parse(readFileSync('messages/en/athletes/profile.json','utf8'))

test('KAN-712 Stats distinguishes explicit H5B DENY from data-source failure', () => {
  assert.match(stats, /result\.status === 'denied'/)
  assert.match(stats, /result\.status === 'error'/)
  assert.match(stats, /AthletePageState message=\{tPlan\('unauthorized'\)\}/)
  assert.match(stats, /summary\.error/)
})

test('KAN-712 Profile distinguishes denied, unknown reference and load failure, never renders protected data on DENY', () => {
  assert.match(profilePage, /performanceResult\.error === 'not_authorized'/)
  assert.match(profile, /performanceStatus/)
  assert.match(profile, /'denied'/)
  assert.match(profile, /'error'/)
  assert.match(profile, /reference\?\.status === 'unknown'/)
})

test('KAN-712 physiological Profile labels are localized for es/en rather than hardcoded', () => {
  for (const locale of [localeEs,localeEn]) {
    for (const key of ['track1000mTime','track1000mPace','track1000mSpeed','track1000mDate','track1000mUnknown','track1000mDenied','track1000mError']) {
      assert.equal(typeof locale.AthleteProfile.physiology[key], 'string', key)
      assert.ok(locale.AthleteProfile.physiology[key].length > 0)
    }
  }
  assert.match(profile, /t\('track1000mPace'\)/)
  assert.match(profile, /t\('track1000mDenied'\)/)
  assert.doesNotMatch(profile, /Sin referencia 1000 m disponible|Velocidad media|Fecha de evaluación/)
})
