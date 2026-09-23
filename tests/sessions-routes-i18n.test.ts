import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const files = [
  'app/[locale]/dashboard/sessions/page.tsx',
  'app/[locale]/dashboard/sessions/new/page.tsx',
]

test('Sessions list and create routes use the Sessions translation boundary', () => {
  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    assert.match(source, /getTranslations\(['"]Sessions['"]\)/, relativePath)
  }
})

test('Sessions list and create routes do not own Spanish product copy', () => {
  const forbidden = [
    'Sesiones',
    'Entrenamientos programados para el equipo.',
    'Nueva sesión',
    'Todavía no hay sesiones',
    'Programá la primera sesión',
    'Mes anterior',
    'Semana anterior',
    'Volver a sesiones',
    'Programá un entrenamiento compartido para el equipo.',
  ]

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    for (const copy of forbidden) assert.equal(source.includes(copy), false, `${relativePath}: ${copy}`)
  }
})
