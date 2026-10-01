import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'),
  'utf8',
)

test('SessionForm localizes group prescription, intensity and empty-state copy', () => {
  for (const copy of [
    'Prescripciones por grupo',
    'Seleccioná al menos un grupo',
    'No hay grupos activos disponibles.',
    'Este grupo no tiene microciclos disponibles.',
    'Seleccionar microciclo',
    'Método de intensidad',
    'Sin intensidad',
    'Zona de frecuencia cardíaca',
    'Porcentaje PAM',
    'Seleccionar zona',
    'Indicaciones para el grupo',
  ]) {
    assert.equal(source.includes(copy), false, copy)
  }

  for (const key of [
    'form.prescriptions.title',
    'form.prescriptions.help',
    'form.prescriptions.noGroups',
    'form.prescriptions.noMicrocycles',
    'form.prescriptions.group',
    'form.prescriptions.intensityMethod',
    'form.prescriptions.noIntensity',
    'form.prescriptions.hrZone',
    'form.prescriptions.referencePercentage',
    'form.prescriptions.selectZone',
    'form.prescriptions.notes',
  ]) {
    assert.equal(source.includes(`t('${key}')`), true, key)
  }

  for (const key of [
    'form.prescriptions.microcycleOption',
    'microcycleUnavailable',
  ]) {
    assert.equal(source.includes(key), true, key)
  }
})

test('ES/EN prescription guidance identifies explicitly selected microcycles rather than promising one prescription per group', () => {
  const es = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/es/planning/sessions.json'), 'utf8'))
  const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/en/planning/sessions.json'), 'utf8'))
  assert.match(es.Sessions.form.prescriptions.help, /microciclos/)
  assert.match(en.Sessions.form.prescriptions.help, /microcycles/i)
  assert.match(source, /t\('form\.prescriptions\.help'\)/)
})
