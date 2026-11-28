import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

async function read(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

test('KAN-725 AGENTS defines non-negotiable focused TDD and continuous closure invariants', async () => {
  const agents = await read('AGENTS.md')

  assert.match(agents, /`pn tdd:red` and `pn tdd` already perform `git pull --ff-only -q`; do not request a separate pull immediately before them/)
  assert.match(agents, /`pn tdd` runs the canonical typecheck; do not separately request `pn tsc` after it/)
  assert.match(agents, /`pn test` is full-suite only/)
  assert.match(agents, /Approval of the closure task authorizes the normal documentation → checks\/review → PR → ordinary merge to `dev` → postmerge verification → Jira\/handoff sequence without repetitive confirmations/i)
  assert.match(agents, /fresh-chat-safe/i)
})

test('KAN-725 harness v2 is the current operational workflow and v1 is historical', async () => {
  const harness = await read('docs/agent-harness.md')

  assert.match(harness, /## Harness v2 — current operational workflow/)
  const stateMachine = harness.split('### Execution state machine')[1]?.split('### Worktree lifecycle')[0] ?? ''
  assert.match(stateMachine, /candidate: full applicable gate \+ real walkthrough \+ AC audit[\s\S]*docs pre-merge reconciliation \+ PR review \/ required checks[\s\S]*ordinary merge to dev \+ exact-SHA postmerge verification[\s\S]*current handoff \+ story handoff \+ index \+ Jira reconciliation[\s\S]*operator-mediated worktree cleanup[\s\S]*fresh-chat-safe/i)
  assert.match(harness, /harness-eval-v1.*historical/i)
  assert.doesNotMatch(harness, /do not change v1 yet/i)
})

test('KAN-725 documentation index tracks latest integrated KAN-810 baseline and retains KAN-790/KAN-792/KAN-688/KAN-778/H4C history', async () => {
  const index = await read('docs/README.md')

  assert.match(index, /KAN-810 regional numeric inputs/)
  assert.match(index, /KAN-790\/T5/)
  assert.match(index, /handoffs\/kan-792\.md/)
  assert.match(index, /handoffs\/kan-688\.md/)
  assert.match(index, /KAN-688 Coach Templates H2\/H3\/H4A merged baseline/)
  assert.match(index, /handoffs\/kan-778\.md/)
  assert.match(index, /handoffs\/kan-606\.md/)
  assert.match(index, /handoffs\/kan-724\.md/)
  assert.match(index, /KAN-606\/H4C merged baseline/)
  assert.match(index, /KAN-609\/H6 is retained in/)
  assert.match(index, /agent-harness\.md.*Harness v2/i)
  assert.doesNotMatch(index, /current execution checkpoint.*following KAN-608 PR #47 merge/i)
  const h5bSection = index
    .split('## Athlete H5B / KAN-608 merged baseline')[1]
    ?.split('\n## ')[0] ?? ''

  assert.doesNotMatch(h5bSection, /handoffs\/kan-609\.md/)
})
