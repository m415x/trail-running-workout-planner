import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const surface = 'features/field-performance-test/components/CoachTrack1000mForm.tsx'

describe('coach track 1000m registration refresh', () => {
  it('refreshes server-derived history after a successful official test registration', async () => {
    const source = await readFile(surface, 'utf8')
    const registerBody = source.match(
      /async function register[\s\S]*?\n  }\n\n  async function correct/,
    )?.[0]

    assert.ok(registerBody, 'register handler should be present')
    assert.match(registerBody, /if \(result\.success\) router\.refresh\(\)/)
  })
})
