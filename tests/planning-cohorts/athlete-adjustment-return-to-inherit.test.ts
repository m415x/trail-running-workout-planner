import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const actions = read('app/actions/athlete-session-adjustment-actions.ts')

test('returning all individual controls to inherit retires the current adjustment', () => {
  assert.match(actions, /state:\s*allInherit\s*\?\s*['"]withdrawn['"]\s*:\s*['"]active['"]/)
  assert.match(actions, /dose\s*===\s*null/)
  assert.match(actions, /assignment\.value\.kind\s*===\s*['"]inherit['"]/)
})

test('a brand-new all-inherit submit does not create a no-op logical adjustment', () => {
  assert.match(actions, /existingAdjustment/)
  assert.match(actions, /if\s*\([^)]*!existingAdjustment[^)]*allInherit|if\s*\(allInherit[^)]*!existingAdjustment/)
})
