import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const config = readFileSync('drizzle.config.ts', 'utf8')

describe('SQLite migration configuration', () => {
  it('uses the versioned SQLite migration directory', () => {
    assert.match(config, /out:\s*['"]\.\/drizzle\/sqlite['"]/)
  })
})
