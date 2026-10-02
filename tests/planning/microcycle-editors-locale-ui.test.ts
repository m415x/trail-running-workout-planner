import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const dates = read('features/planning/components/MicrocycleDatesForm.tsx')
const notes = read('features/planning/components/MicrocycleNotesForm.tsx')
const elevation = read('features/planning/components/MicrocycleElevationForm.tsx')
const page = read('app/[locale]/dashboard/planning/[planId]/page.tsx')
const translations = ['es', 'en'].map(locale => JSON.parse(
  read('messages/' + locale + '/planning/coach-planning.json'),
).CoachPlanning)

test('KAN-577 microcycle date, note and elevation forms localize accessible fields and help', () => {
  for (const [source, keys] of [
    [dates, ['startDateAria', 'endDateAria']],
    [notes, ['notesPlaceholder', 'notesAria', 'notesHelp']],
    [elevation, ['elevationPlaceholder', 'elevationAria', 'sourceManual', 'sourceGenerated']],
  ] as const) {
    for (const key of keys) {
      assert.ok(source.includes('microcycleEditor.' + key), 'missing UI translation ' + key)
      for (const m of translations) assert.ok(m.microcycleEditor?.[key], 'missing ES/EN key ' + key)
    }
  }
  assert.doesNotMatch(notes, /placeholder='Agregá indicaciones/)
  assert.doesNotMatch(elevation, /aria-label='Desnivel positivo objetivo/)
  assert.doesNotMatch(dates, /aria-label='Fecha inicial del microciclo/)
})

test('KAN-577 translated microcycle table retains columns and unchanged form ownership', () => {
  for (const key of ['week', 'type', 'dates', 'elevation', 'notes', 'targetVolume']) {
    assert.ok(page.includes("t('detail.table." + key + "')"))
    for (const m of translations) assert.ok(m.detail?.table?.[key])
  }
  for (const component of [
    'MicrocycleTypeForm', 'MicrocycleDatesForm', 'MicrocycleElevationForm',
    'MicrocycleNotesForm', 'MicrocycleVolumeForm',
  ]) assert.ok(page.includes('<' + component))
  assert.ok(dates.includes('updateMicrocycleDates'))
  assert.ok(notes.includes('updateMicrocycleNotes'))
  assert.ok(elevation.includes('updateMicrocycleElevation'))
})
