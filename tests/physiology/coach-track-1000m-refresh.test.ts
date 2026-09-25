import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const surface = 'features/field-performance-test/components/CoachTrack1000mForm.tsx'

describe('coach track 1000m registration refresh', () => {
  it('refreshes server-derived history after a successful official test registration', async () => {
    const source = await readFile(surface, 'utf8')
    const registerStart = source.indexOf('async function register(')
    const correctStart = source.indexOf('async function correct(', registerStart)

    assert.notEqual(registerStart, -1, 'register handler should be present')
    assert.notEqual(correctStart, -1, 'correct handler should follow register')
    const registerBody = source.slice(registerStart, correctStart)

    assert.match(registerBody, /if \(result\.success\) router\.refresh\(\)/)
  })
})
