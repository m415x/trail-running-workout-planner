import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

test('KAN-618 edit delegates to AthleteProfile administration without mutating User EPT', () => {
  const action = source('app/actions/athlete-actions.ts')

  assert.match(action, /updateAthleteAdministration/)
  assert.doesNotMatch(action, /\.update\(users\)/)
  assert.match(action, /nameWriteIntent/)
})
