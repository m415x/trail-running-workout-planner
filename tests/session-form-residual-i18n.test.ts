import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'),
  'utf8',
)

test('SessionForm localizes residual notes, prescription fields and actions', () => {
  for (const copy of [
    'Priorizá el esfuerzo sobre el ritmo.',
    'Notas',
    'Indicaciones generales de la sesión…',
    'Grupo ',
    'Microciclo',
    'Distancia (km)',
    'Duración (min)',
    'Desnivel (m+)',
    "label='Zona'",
    'Cancelar',
    'Guardando…',
    'Guardar cambios',
    'Crear sesión',
  ]) {
    assert.equal(source.includes(copy), false, copy)
  }

  for (const key of [
    'form.trailEffortNote',
    'form.notes',
    'form.notesPlaceholder',
    'form.prescriptions.group',
    'form.prescriptions.distance',
    'form.prescriptions.duration',
    'form.prescriptions.zone',
    'form.actions.cancel',
    'form.actions.saving',
    'form.actions.saveChanges',
    'form.actions.create',
  ]) {
    assert.equal(source.includes(`t('${key}')`), true, key)
  }

  // The microcycle option is interpolated with plan, week, start and end.
  assert.match(source, /t\('form\.prescriptions\.microcycleOption',\s*\{/)
})

test('The delegated vertical editor localizes the whole-session elevation label in both languages', () => {
  const editor = fs.readFileSync(path.join(process.cwd(), 'features/sessions/components/VerticalPrescriptionEditor.tsx'), 'utf8')
  assert.match(source, /<VerticalPrescriptionEditor/)
  assert.match(editor, /useTranslations\('Sessions\.form\.prescriptions\.vertical'\)/)
  assert.match(editor, /t\('wholeGain'\)/)
  assert.equal(editor.includes('Desnivel (m+)'), false)
  for (const locale of ['es', 'en']) {
    const messages = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages', locale, 'planning/sessions.json'), 'utf8'))
    assert.ok(messages.Sessions.form.prescriptions.vertical.wholeGain)
  }
})
