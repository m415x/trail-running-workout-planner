import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-790 T5.5 legacy multipart generation Action cannot persist client proposal', () => {
  const source=readFileSync('app/actions/session-generation-actions.ts','utf8')
  // The previously exported action remains a callable Next Server Action
  // even when the new Coach form stops referencing it.
  assert.doesNotMatch(source,/formData\.get\(['"]proposal['"]\)/,
    'legacy endpoint must not trust caller-supplied generation proposal')
  assert.doesNotMatch(source,/formData\.get\(['"]generationExplanations['"]\)/,
    'legacy endpoint must not accept caller-supplied explanation payload')
  assert.doesNotMatch(source,/reconcileAndPersistGeneratedSessionsSqlite\(/,
    'legacy multipart entry point must no longer reach the SQLite writer')
})
