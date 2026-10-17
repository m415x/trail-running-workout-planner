import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const production = readFileSync(
  'lib/session-generation/authorized-review-snapshot-next-server.ts',
  'utf8',
)
const sqlite = readFileSync(
  'lib/session-generation/authorized-review-snapshot-sqlite-scope.ts',
  'utf8',
)

test('KAN-790 T5.1 Next-server snapshot lookup rejects expired ACTIVE snapshots', () => {
  assert.match(production, /sessionGenerationReviewSnapshots\.expiresAt/)
  assert.match(production, /gt\(sessionGenerationReviewSnapshots\.expiresAt,\s*now/)
  assert.match(sqlite, /expires_at\s*>\s*\?/)
})

test('KAN-790 T5.1 production authorization delegates to shared scope with no snapshot mutation', () => {
  assert.match(production, /resolveAuthorizedReviewSnapshotScope/)
  assert.match(production, /createH4aNextServerAuthorizationBoundary/)
  assert.doesNotMatch(production, /\.insert\(|\.update\(|\.delete\(|\.run\(/)
})
