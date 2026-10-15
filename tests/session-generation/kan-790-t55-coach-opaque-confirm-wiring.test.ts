import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-790 T5.5 Coach preview confirms an opaque snapshot ID, not a client proposal', () => {
  const preview=readFileSync(
    'features/planning/components/SessionGenerationPreview.tsx','utf8',
  )
  const actions=readFileSync('app/actions/session-generation-actions.ts','utf8')

  // The real React/Next form is the integration target; the historical raw
  // multipart payload must no longer be an authority for CONFIRM.
  assert.doesNotMatch(preview,/name=['"]proposal['"]/,
    'Coach confirm form must not upload the generated proposal')
  assert.doesNotMatch(preview,/name=['"]generationExplanations['"]/,
    'Coach confirm form must not upload verbose explanations')
  assert.match(preview,/name=['"]snapshotId['"]/,
    'Coach confirm form must send only the opaque server-issued snapshot locator')
  assert.match(actions,/createAuthorizedReviewSnapshotPostgresSessionOperations/,
    'real Next Server Action must use the authorized PG confirmation composition')
  assert.doesNotMatch(actions,/formData\.get\(['"]proposal['"]\)/,
    'confirm action may not take client-provided proposal as write authority')
})
