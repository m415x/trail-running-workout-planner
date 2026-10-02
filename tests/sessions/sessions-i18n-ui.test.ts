import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const preferences = read('features/planning/components/SessionGenerationPreferencesForm.tsx')
const preview = read('features/planning/components/SessionGenerationPreview.tsx')
const types = read('features/planning/components/MicrocycleTypeForm.tsx')
const locales = ['es', 'en'].map((locale) => JSON.parse(
  read('messages/' + locale + '/planning/coach-planning.json'),
).CoachPlanning)

test('KAN-577 weekly preferences localize visible heading, help and state copy', () => {
  for (const key of ['title', 'description', 'frequencyLabel', 'automatic', 'frequencyHelp',
    'patternTitle', 'patternHelp', 'roleAriaLabel', 'minDays']) {
    assert.ok(preferences.includes("t('sessionGeneration." + key + "'"), key)
    for (const m of locales) assert.ok(m.sessionGeneration?.[key], key)
  }
  assert.doesNotMatch(preferences, />Generación semanal de sesiones</)
  assert.doesNotMatch(preferences, /Seleccioná al menos 3 días habituales/)
})

test('KAN-577 weekly role selected text is translated, not a raw stored enum', () => {
  assert.match(preferences, /<SelectValue>\{t\(/)
  assert.match(preferences, /roles\.\$\{day\.role\}/)
  assert.match(preferences, /roles\.\$\{role\}/)
  assert.match(preferences, /name='weeklyPattern' value=\{patternPayload\}/)
  for (const m of locales) for (const key of ['base','mountain','long','quality','recovery','competition']) {
    assert.ok(m.roles?.[key], key)
  }
})

test('KAN-577 session generation preview uses translatable copy', () => {
  for (const key of ['title','description','notSaved','ready','week','review','saveHelp']) {
    assert.ok(preview.includes("t('sessionPreview." + key + "'"), key)
    for (const m of locales) assert.ok(m.sessionPreview?.[key], key)
  }
  assert.doesNotMatch(preview, />Vista previa de sesiones</)
  assert.doesNotMatch(preview, />Revisá la propuesta</)
})

test('KAN-577 microcycle type picker translates its visible options and accessible name', () => {
  assert.ok(types.includes("t('microcycleType.ariaLabel')"))
  assert.match(types, /microcycleType\.types\./)
  for (const m of locales) {
    assert.ok(m.microcycleType?.ariaLabel)
    for (const key of ['base','development','shock','deload','tapering','race']) {
      assert.ok(m.microcycleType?.types?.[key], key)
    }
  }
})
