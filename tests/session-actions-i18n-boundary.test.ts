import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actionSource = fs.readFileSync(path.join(process.cwd(), 'app/actions/session-actions.ts'), 'utf8')
const formSource = fs.readFileSync(path.join(process.cwd(), 'features/sessions/components/SessionForm.tsx'), 'utf8')

test('Session actions return localization-safe error codes instead of Spanish product copy', () => {
  assert.match(actionSource, /errorCode/)
  assert.doesNotMatch(actionSource, /Ingresá una fecha válida|El título debe tener|Seleccioná un tipo de entrenamiento|Revisá los datos ingresados/)
  assert.doesNotMatch(actionSource, /La plantilla de entrenamiento seleccionada|La ubicación seleccionada|No se pudo identificar la sesión|Sesión no encontrada/)
  assert.doesNotMatch(actionSource, /Uno de los grupos seleccionados|El microciclo seleccionado no pertenece/)
})

test('SessionForm translates server-side error codes at the UI boundary', () => {
  assert.match(formSource, /state\.errorCode/)
  assert.match(formSource, /t\(`form\.errors\.server\.\$\{state\.errorCode\}`/)
})
