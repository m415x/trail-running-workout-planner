import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectDeniedHtml, isControlledH3Deny } from '../../lib/acceptance/response-oracles'

const canaries = ['athlete-id-12345', 'athlete@example.test']
const denied = '<main><h1>Acceso no disponible</h1><p>No se pudo determinar un equipo y acceso válidos.</p></main>'

test('KAN-850 H3 controlled DENY requires expected boundary and no canary exposure', () => {
  assert.equal(isControlledH3Deny(inspectDeniedHtml(denied, canaries)), true)
  for (const exposed of [canaries[0], JSON.stringify(canaries[0]).slice(1, -1), encodeURIComponent(canaries[1])]) {
    assert.equal(isControlledH3Deny(inspectDeniedHtml(denied + exposed, canaries)), false)
  }
})

test('KAN-850 H3 rejects table/login in denied response', () => {
  assert.equal(isControlledH3Deny(inspectDeniedHtml(denied + '<table></table>', canaries)), false)
  assert.equal(isControlledH3Deny(inspectDeniedHtml(denied + '<input type="password">', canaries)), false)
  assert.equal(isControlledH3Deny(inspectDeniedHtml('<main>Denied</main>', canaries)), false)
})

test('KAN-850 H3 rejects vacuous canary checks', () => {
  assert.throws(() => inspectDeniedHtml(denied, []))
  assert.throws(() => inspectDeniedHtml(denied, ['x']))
})
