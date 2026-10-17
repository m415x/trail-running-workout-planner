import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const actions=readFileSync('app/actions/coach-session-review-snapshot-actions.ts','utf8')
const route=readFileSync('app/[locale]/dashboard/planning/[planId]/review/page.tsx','utf8')
const renderer=readFileSync('features/planning/components/CoachPostgresSnapshotReview.tsx','utf8')

test('KAN-791 T6-C explicit CREATE is available on dedicated authorized review route',()=>{
  assert.match(route,/createCoachSessionReviewSnapshot/)
  assert.match(route,/name=['"]planId['"]/)
  assert.match(route,/name=['"]locale['"]/)
  assert.match(route,/<form/)
  assert.match(route,/!snapshotId/)
})

test('KAN-791 T6-C CREATE and CONFIRM return to PostgreSQL review route, not SQLite planning',()=>{
  assert.match(actions,/\/planning\/\$\{encodeURIComponent\(planId\)\}\/review\?snapshotId=/)
  assert.match(actions,/redirect\(\`\$\{base\}\/planning\/\$\{encodeURIComponent\(planId\)\}\/review\`\)/)
})

test('KAN-791 T6-C reviewed snapshot CONFIRM stays opaque and sends no proposal payload',()=>{
  assert.match(renderer,/SessionGenerationPreview/)
  assert.doesNotMatch(renderer,/generationExplanations:JSON\.stringify|name=['"]proposal['"]|name=['"]generationExplanations['"]/)
  assert.match(actions,/snapshotId=formData\.get\('snapshotId'\)/)
})
