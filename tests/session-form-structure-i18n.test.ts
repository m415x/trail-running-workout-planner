import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(
  path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'),
  'utf8',
)

test('SessionForm localizes template, location, track and structure copy', () => {
  for (const copy of [
    'Plantilla de entrenamiento',
    'Sin plantilla',
    'Ubicación',
    'Sin ubicación',
    'Ruta o referencia del track (opcional)',
    'Estructura de la sesión',
    'Todos los bloques son opcionales.',
    'Ejercicios preliminares',
    'Entrada en calor',
    'Bloque principal',
    'Vuelta a la calma',
  ]) {
    assert.equal(source.includes(copy), false, copy)
  }

  for (const key of [
    'form.template',
    'form.noTemplate',
    'form.location',
    'form.noLocation',
    'form.track',
    'form.structure.title',
    'form.structure.help',
    'form.structure.preliminaryExercises',
    'form.structure.warmup',
    'form.structure.mainBlock',
    'form.structure.cooldown',
  ]) {
    assert.equal(source.includes(`t('${key}')`), true, key)
  }
})
