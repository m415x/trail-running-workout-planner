import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'features',
    'planning',
    'components',
    'GenerationExplanationView.tsx',
  ),
  'utf8',
)

test('explanation facts render human labels instead of raw internal codes', () => {
  assert.match(source, /formatGenerationExplanationLabel\(fact\.code, locale, planningSubgroupLabel\)/)
  assert.doesNotMatch(source, /\{fact\.code\}:\s*\{String\(fact\.value/)
})

test('explanation warnings render localized operational messages instead of raw warning codes', () => {
  assert.match(
    source,
    /formatGenerationExplanationWarning\(warning\.code, locale\)/,
  )
  assert.doesNotMatch(
    source,
    /<span className='font-medium'>\{warning\.code\}<\/span>/,
  )
})

test('known generation reasons have ES and EN presentation labels', () => {
  assert.match(source, /target_volume_km/)
  assert.match(source, /Volumen objetivo/)
  assert.match(source, /Target volume/)

  assert.match(source, /omitted_habitual_slot_keys/)
  assert.match(source, /Días habituales omitidos/)
  assert.match(source, /Omitted habitual days/)

  assert.match(source, /recovery_constraint_changed_selection/)
  assert.match(source, /La recuperación modificó la distribución/)
  assert.match(source, /Recovery changed the distribution/)

  assert.match(source, /race_replaced_habitual_slot/)
  assert.match(source, /La competencia reemplazó un día habitual/)
  assert.match(source, /Race replaced a habitual day/)

  assert.match(source, /no_compatible_template/)
  assert.match(source, /No hubo una plantilla compatible/)
  assert.match(source, /No compatible template was available/)

  assert.match(source, /reference_percentage_target_missing/)
  assert.match(source, /Falta el porcentaje de referencia/)
  assert.match(source, /Reference percentage is missing/)

  assert.match(source, /intense_sessions_not_fully_assigned/)
  assert.match(source, /No pudieron ubicarse todas las sesiones intensas/)
  assert.match(source, /Not all intense sessions could be assigned/)

  assert.match(source, /protected_generation_collision/)
  assert.match(source, /Se preservó una edición del Coach/)
  assert.match(source, /A Coach edit was preserved/)
})
