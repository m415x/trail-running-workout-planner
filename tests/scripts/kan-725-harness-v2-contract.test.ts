import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

async function read(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

test('KAN-725 AGENTS defines non-negotiable focused TDD and continuous closure invariants', async () => {
  const agents = await read('AGENTS.md')

  assert.match(agents, /Never request `git pull` separately when the next local command is `pn tdd:red` or `pn tdd`/)
  assert.match(agents, /Never request `pn tsc` separately after `pn tdd`/)
  assert.match(agents, /`pn test` is full-suite only/)
  assert.match(agents, /approved closure task authorizes the routine closure sequence/i)
  assert.match(agents, /documentation.*PR.*review.*merge.*post-merge reconciliation.*Jira/is)
  assert.match(agents, /fresh-chat-safe/i)
})

test('KAN-725 harness v2 is the current operational workflow and v1 is historical', async () => {
  const harness = await read('docs/agent-harness.md')

  assert.match(harness, /## Harness v2 — current operational workflow/)
  assert.match(harness, /candidate.*gate.*walkthrough.*docs pre-merge.*PR.*merge.*post-merge reconciliation.*fresh-chat-safe/is)
  assert.match(harness, /harness-eval-v1.*historical/i)
  assert.doesNotMatch(harness, /do not change v1 yet/i)
})

test('KAN-725 documentation index names the current H6 baseline without stale KAN-608 current wording', async () => {
  const index = await read('docs/README.md')

  assert.match(index, /KAN-609\/H6 merged checkpoint/)
  assert.match(index, /agent-harness\.md.*Harness v2/i)
  assert.doesNotMatch(index, /current execution checkpoint.*following KAN-608 PR #47 merge/i)
  assert.doesNotMatch(index, /## Athlete H5B \/ KAN-608 merged baseline[\s\S]*handoffs\/kan-609\.md/)
})
