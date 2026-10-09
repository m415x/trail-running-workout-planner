import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('app/[locale]/(mobile)/page.tsx', 'utf8')

test('KAN-703 Home presents explicit unauthorized state before generic loading failure', () => {
  assert.match(home, /athleteRes\.forbidden|realizedRes\.status\s*===\s*['"]denied['"]/)
  assert.match(home, /getTranslations\(\{\s*locale,\s*namespace:\s*['"]AthletePlan['"]\s*\}\)/)
  assert.match(home, /tPlan\(['"]unauthorized['"]\)/)
  assert.ok(home.indexOf("tPlan('unauthorized')") < home.indexOf("t('errors.saveFailed')"))
})
