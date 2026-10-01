import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = readFileSync('package.json', 'utf8')
const mapSource = readFileSync('components/maps/MapInner.tsx', 'utf8')
const copyScript = readFileSync('scripts/copy-maplibre-worker.mjs', 'utf8')

test('KAN-561 configures the MapLibre v6 worker explicitly for Next.js', () => {
  assert.match(mapSource, /setWorkerUrl/)
  assert.match(
    mapSource,
    /setWorkerUrl\(['"]\/maplibre\/maplibre-gl-worker\.mjs['"]\)/,
  )

  assert.match(packageJson, /"predev":\s*"node \.\/scripts\/copy-maplibre-worker\.mjs"/)
  assert.match(packageJson, /"prebuild":\s*"node \.\/scripts\/copy-maplibre-worker\.mjs"/)
})

test('KAN-561 copies both MapLibre ESM worker files required by Next bundling', () => {
  assert.match(copyScript, /maplibre-gl-worker\.mjs/)
  assert.match(copyScript, /maplibre-gl-shared\.mjs/)
  assert.match(copyScript, /public['"],\s*['"]maplibre['"]/)
})
