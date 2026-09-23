import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const detail = read('app/[locale]/dashboard/sessions/[sessionId]/page.tsx')
const edit = read('app/[locale]/dashboard/sessions/[sessionId]/edit/page.tsx')

test('Session detail and edit routes localize visible product copy', () => {
  assert.match(detail, /getTranslations\(['"]Sessions['"]\)/)
  assert.match(detail, /getTranslations\(['"]Workouts['"]\)/)
  assert.match(edit, /getTranslations\(['"]Sessions['"]\)/)

  for (const copy of [
    'Volver al calendario', 'Editar', 'Información general', 'Datos compartidos de la sesión.',
    'Ubicación', 'Plantilla', 'Notas', 'Sin notas generales.', 'Estructura de la sesión',
    'Esta sesión no tiene una estructura detallada.', 'Sin especificar',
  ]) assert.equal(detail.includes(copy), false, copy)

  for (const copy of ['Volver al detalle', 'Editar sesión', 'Actualizá la sesión']) {
    assert.equal(edit.includes(copy), false, copy)
  }

  assert.doesNotMatch(detail, /DateTimeFormat\(['"]es-AR['"]/)
  assert.doesNotMatch(detail, />\s*\{session\.type\}\s*</)
})
