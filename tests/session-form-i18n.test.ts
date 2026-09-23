import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'),
  'utf8',
)

test('SessionForm owns a Sessions translation boundary and localizes workout type labels', () => {
  assert.match(source, /useTranslations\(['"]Sessions['"]\)/)
  assert.match(source, /useTranslations\(['"]Workouts['"]\)/)
  assert.match(source, /workoutTypeT\(`types\.\$\{type\}`\)/)
})

test('SessionForm no longer renders its core identity copy as hard-coded Spanish', () => {
  for (const copy of [
    'Fecha',
    'Título',
    'Tipo de entrenamiento',
    'Seleccionar tipo',
    'Ej.: Fondo de montaña',
    'Asigná la sesión al menos a un grupo',
  ]) {
    assert.equal(source.includes(copy), false, copy)
  }
})
