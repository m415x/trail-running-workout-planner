import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

for (const path of [
  'lib/memberships/membership-policy-view-model.ts',
  'lib/memberships/athlete-membership-view-model.ts',
]) {
  test(`KAN-506 economic formatter consumes the regional presentation boundary: ${path}`, async () => {
    const source = await readFile(path, 'utf8')

    assert.match(source, /resolveApplicationRegionalContext/)
    assert.doesNotMatch(
      source,
      /locale === ['"]es['"] \? ['"]es-AR['"] : ['"]en-US['"]/,
    )
    assert.match(source, /currency/)
  })
}
