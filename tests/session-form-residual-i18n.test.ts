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
    'form.prescriptions.microcycle',
    'form.prescriptions.distance',
    'form.prescriptions.duration',
    'form.prescriptions.elevationGain',
    'form.prescriptions.zone',
    'form.actions.cancel',
    'form.actions.saving',
    'form.actions.saveChanges',
    'form.actions.create',
  ]) {
    assert.equal(source.includes(`t('${key}')`), true, key)
  }
})
