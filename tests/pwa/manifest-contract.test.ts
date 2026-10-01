import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const manifestSource = readFileSync('app/manifest.ts', 'utf8')
const globalsCss = readFileSync('app/globals.css', 'utf8')
const designSystemDoc = readFileSync(
  'docs/architecture/platform/ui-design-system.md',
  'utf8',
)

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


test('KAN-560 preserves the existing install icon contract without inventing unsupported maskable assets', () => {
  assert.match(
    manifestSource,
    /src:\s*['"]\/icon-192x192\.png['"][\s\S]*sizes:\s*['"]192x192['"][\s\S]*type:\s*['"]image\/png['"]/,
  )
  assert.match(
    manifestSource,
    /src:\s*['"]\/icon-512x512\.png['"][\s\S]*sizes:\s*['"]512x512['"][\s\S]*type:\s*['"]image\/png['"]/,
  )

  assert.doesNotMatch(manifestSource, /purpose:\s*['"][^'"]*maskable/)
  assert.doesNotMatch(manifestSource, /screenshots\s*:/)
})

test('KAN-560 documents the PWA Brand derivation and role boundary durably', () => {
  assert.match(designSystemDoc, /single PWA/i)
  assert.match(designSystemDoc, /Coach and Athlete/i)
  assert.match(designSystemDoc, /theme_color[\s\S]*--brand-action/)
  assert.match(designSystemDoc, /background_color[\s\S]*--background/)
  assert.match(designSystemDoc, /manifest cannot consume CSS custom properties directly/i)
  assert.match(designSystemDoc, /shortcuts[\s\S]*KAN-298/i)
  assert.match(designSystemDoc, /maskable[\s\S]*safe-zone/i)
  assert.match(designSystemDoc, /screenshots[\s\S]*not fabricated/i)
})
