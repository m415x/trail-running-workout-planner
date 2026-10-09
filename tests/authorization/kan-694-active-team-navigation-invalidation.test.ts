import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const action = readFileSync('app/actions/team-context-actions.ts', 'utf8')

test('KAN-694 accepted active Team selection invalidates the Coach dashboard layout', () => {
  assert.match(action, /revalidatePath\('\/\[locale\]\/dashboard',\s*'layout'\)/)
  assert.match(action, /result\.status === 'accepted'/)
})

test('KAN-694 must not invalidate the Coach layout for rejected or forbidden Team selection', () => {
  assert.match(action, /if \(result\.status === 'accepted'\)\s*\{[\s\S]*?revalidatePath/)
  assert.doesNotMatch(action, /return context\.select\(access\.userId, proposedTeamId\)/)
})
