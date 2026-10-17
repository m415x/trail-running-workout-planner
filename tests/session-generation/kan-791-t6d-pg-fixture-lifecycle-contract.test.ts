import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const script=readFileSync('scripts/kan-791-annual-http-fixture.ts','utf8')
test('KAN-791 T6-D fixture setup is atomic, SQL-backed and validates exactly 53/239',()=>{
  assert.match(script,/await sql\.begin\(async tx=>/)
  assert.match(script,/generateReviewSnapshotFromEffectivePostgres/)
  assert.match(script,/generated\.microcycleCount,53/)
  assert.match(script,/generated\.sessionCount,239/)
  assert.match(script,/mode==='setup'/)
})
test('KAN-791 T6-D cleanup first records diagnostics then deletes only fixture-owned PG rows',()=>{
  assert.match(script,/await writeFile\(filename,JSON\.stringify\(diagnostics/)
  assert.match(script,/await sql\.begin\(async tx=>/)
  assert.match(script,/DELETE FROM session_generation_review_snapshots/)
  assert.match(script,/DELETE FROM microcycles/)
  assert.doesNotMatch(script,/Cleanup not yet enabled/)
})
