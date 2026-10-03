import assert from 'node:assert/strict'
import test from 'node:test'

import { runCoachSandboxMigrationCli } from '../../scripts/coach-sandbox-migrate-cli'

test('KAN-598/C11 rejects invocation without explicit operation before any migration callback', async () => {
  let invoked = false
  await assert.rejects(() => runCoachSandboxMigrationCli({
    args: [],
    repositoryRoot: process.cwd(),
    applyMigration: async () => { invoked = true },
  }), /explicit|operation|argument|approval/i)
  assert.equal(invoked, false)
})

test('KAN-598/C11 rejects unexpected options and arbitrary URLs before any migration callback', async () => {
  for (const args of [
    ['--apply', '--url', 'postgresql://postgres:secret@db.example.org:5432/postgres'],
    ['--apply', '--force'],
    ['--reset'],
    ['--apply', '--apply'],
  ]) {
    let invoked = false
    await assert.rejects(() => runCoachSandboxMigrationCli({
      args,
      repositoryRoot: process.cwd(),
      applyMigration: async () => { invoked = true },
    }), /argument|operation|unsupported|invalid|explicit/i)
    assert.equal(invoked, false)
  }
})

test('KAN-598/C11 accepts exactly --apply only through a caller-provided migration function', async () => {
  const roots: string[] = []
  await runCoachSandboxMigrationCli({
    args: ['--apply'],
    repositoryRoot: process.cwd(),
    applyMigration: async root => { roots.push(root) },
  })
  assert.deepEqual(roots, [process.cwd()])
})
