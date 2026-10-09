import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/realized-training-actions.ts', 'utf8')
const from = source.indexOf('export async function createManualRealizedTrainingAction(')
const until = source.indexOf('export async function correctManualRealizedTrainingAction(', from)
assert.ok(from >= 0 && until > from)
const create = source.slice(from, until)

test('KAN-701 production Server Action delegates manual capture validation to the tested SELF write boundary', () => {
  assert.match(source, /import \{ createManualSelfCaptureBoundary \} from ['"]@\/lib\/realized-training\/manual-self-capture-boundary['"]/)
  assert.match(create, /createManualSelfCaptureBoundary\(/)
  assert.match(create, /resolveSelf:/)
  assert.match(create, /resolveEffectiveSession:/)
  assert.match(create, /persist:/)
  assert.match(create, /createManualRealizedTrainingRecord/)
})

test('KAN-701 production action does not bypass free-workout locator rejection through a second direct persistence path', () => {
  assert.equal((create.match(/createManualRealizedTrainingRecord\(/g) ?? []).length, 1)
  assert.match(create, /\.create\(access, input,/)
})
