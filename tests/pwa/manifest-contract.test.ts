import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const manifestSource = readFileSync('app/manifest.ts', 'utf8')
const globalsCss = readFileSync('app/globals.css', 'utf8')

test('KAN-560 exposes the approved single-PWA identity and navigation contract', () => {
  assert.match(manifestSource, /name:\s*['"]El Parque Team['"]/)
  assert.match(manifestSource, /short_name:\s*['"]EPT['"]/)
  assert.match(
    manifestSource,
    /description:\s*['"]Planificación, seguimiento y gestión de entrenamiento de trail running para equipos y atletas\.['"]/,
  )
  assert.match(manifestSource, /id:\s*['"]\/['"]/)
  assert.match(manifestSource, /start_url:\s*['"]\/['"]/)
  assert.match(manifestSource, /scope:\s*['"]\/['"]/)
  assert.match(manifestSource, /display:\s*['"]standalone['"]/)
  assert.match(manifestSource, /orientation:\s*['"]any['"]/)
  assert.match(manifestSource, /categories:\s*\[['"]sports['"],\s*['"]fitness['"]\]/)

  assert.doesNotMatch(manifestSource, /shortcuts\s*:/)
})

test('KAN-560 serializes PWA colors from the existing Brand foundations instead of placeholders', () => {
  assert.match(globalsCss, /--brand-action:\s*oklch\(0\.68 0\.198 42\)/)
  assert.match(globalsCss, /--background:\s*oklch\(0\.99 0\.003 240\)/)

  // sRGB serializations of the light Brand/action and application background
  // foundations. The manifest cannot consume CSS custom properties directly.
  assert.match(manifestSource, /theme_color:\s*['"]#f76215['"]/i)
  assert.match(manifestSource, /background_color:\s*['"]#fafcfe['"]/i)

  assert.doesNotMatch(manifestSource, /theme_color:\s*['"]#000000['"]/i)
  assert.doesNotMatch(manifestSource, /background_color:\s*['"]#ffffff['"]/i)
})
