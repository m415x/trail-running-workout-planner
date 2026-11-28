import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const agents = readFileSync('AGENTS.md', 'utf8')
const harness = readFileSync('docs/agent-harness.md', 'utf8')

test('Harness v2 makes guarded Post-merge Worktree Cleanup a closure phase', () => {
  assert.match(agents, /Post-merge Worktree Cleanup/)
  const stateMachine = harness.split('### Execution state machine')[1]?.split('### Worktree lifecycle')[0] ?? ''
  assert.match(stateMachine, /ordinary merge to dev[\s\S]*exact-SHA postmerge verification[\s\S]*Jira reconciliation[\s\S]*operator-mediated worktree cleanup \(or documented blocker\)[\s\S]*fresh-chat-safe/i)
  const cleanup = harness.split('### Post-merge Worktree Cleanup')[1]?.split('### Runner invariants')[0] ?? ''
  assert.match(cleanup, /mandatory[\s\S]*after merge, post-merge gate and docs\/Jira reconciliation/i)
  assert.match(cleanup, /worktree retired or operational blocker documented/i)
  assert.match(agents, /worktree retired or operational blocker documented/i)
})

test('Harness v2 distinguishes existing worktrees, prunable records and retained local branches', () => {
  for (const source of [agents, harness]) {
    assert.match(source, /git worktree list --porcelain/)
    assert.match(source, /git worktree prune --dry-run --verbose/)
    assert.match(source, /git worktree prune --verbose/)
    assert.match(source, /git worktree remove <path>/)
    assert.match(source, /prunable/)
    assert.match(source, /local branches/i)
  }
})

test('Cleanup requires evidence protection and human authorization, never automated destruction', () => {
  for (const source of [agents, harness]) {
    assert.match(source, /ignored.*untracked|untracked.*ignored/i)
    assert.match(source, /operator.*confirm|operator.*approval|operator.*authorization/i)
    assert.match(source, /git clean -fdx/)
    assert.match(source, /git branch -D/)
    assert.match(source, /KAN-645.*KAN-359.*KAN-832/)
    assert.match(source, /without repeating functional gates|no repeat of functional gates/i)
  }
})
