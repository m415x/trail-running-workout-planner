import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const actions = 'app/actions/field-performance-test-actions.ts'

describe('coach track 1000m server revalidation', () => {
  it('revalidates the localized athlete detail after a successful official test registration', async () => {
    const source = await readFile(actions, 'utf8')

    assert.match(source, /import \{ revalidatePath \} from 'next\/cache'/)
    assert.match(
      source,
      /createCoachTrack1000mEvidenceAction[\s\S]*?revalidatePath\([^\n]*dashboard\/athletes/,
    )
  })
})
