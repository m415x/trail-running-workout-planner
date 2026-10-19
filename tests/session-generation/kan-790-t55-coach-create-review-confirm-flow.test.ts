import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-790 T5.5 Coach review uses an explicit CREATE then durable GET and opaque CONFIRM', () => {
  const page=readFileSync('app/[locale]/dashboard/planning/[planId]/page.tsx','utf8')
  const preview=readFileSync('features/planning/components/SessionGenerationPreview.tsx','utf8')
  const actions=readFileSync('app/actions/coach-session-review-snapshot-actions.ts','utf8')

  assert.match(actions,/createCoachSessionReviewSnapshot/)
  assert.match(actions,/readCoachSessionReviewSnapshot/)
  assert.match(actions,/confirmCoachSessionReviewSnapshot/)
  assert.match(page,/readCoachSessionReviewSnapshot/,
    'Coach page must load the durable authorized snapshot for review')
  assert.match(preview,/createCoachSessionReviewSnapshot/,
    'Coach UI must request CREATE explicitly before confirmation')
  assert.match(preview,/confirmCoachSessionReviewSnapshot/,
    'Coach UI must confirm only the already-reviewed snapshot')
  assert.match(preview,/name=['"]snapshotId['"]/,
    'CONFIRM must submit an opaque server-issued ID')
  assert.doesNotMatch(preview,/name=['"]proposal['"]|name=['"]generationExplanations['"]/,
    'Neither proposal nor explanations may travel in CONFIRM')
})
