import assert from 'node:assert/strict'
import test from 'node:test'

// C14 intentionally remains RED until its operational module is approved.
// Resolve that missing module at runtime, not during the unrelated C15
// TypeScript gate; do not fabricate a stub implementation or mark C14 GREEN.
type InstalledMigrationInput = {
  repositoryRoot: string
  directUrl: string
  authorizeExecution: () => Promise<boolean>
}
type OperationRequest = {
  args: readonly string[]
  repositoryRoot: string
  authorizeExecution?: () => Promise<boolean>
  invokeInstalledMigration?: (input: InstalledMigrationInput) => Promise<void>
}
const pendingModulePath: string = [
  '../../scripts',
  'coach-sandbox-migration-operation',
].join('/')

async function runGuardedCoachSandboxMigrationOperation(
  request: OperationRequest,
): Promise<void> {
  const loaded = await import(pendingModulePath) as {
    runGuardedCoachSandboxMigrationOperation: (request: OperationRequest) => Promise<void>
  }
  return loaded.runGuardedCoachSandboxMigrationOperation(request)
}

const localUrl = 'postgresql://postgres:fixture-not-a-secret@127.0.0.1:54322/postgres'

test('KAN-598/C14 refuses --apply without a runtime execution authorization before any coordinator call', async () => {
  let called = false
  await assert.rejects(() => runGuardedCoachSandboxMigrationOperation({
    args: ['--apply'],
    repositoryRoot: process.cwd(),
    invokeInstalledMigration: async () => { called = true },
  }), /authorization|consent|approval/i)
  assert.equal(called, false)
})

test('KAN-598/C14 binds the only supported local endpoint and passes runtime authorization to installed coordinator', async () => {
  const calls: { root: string; url: string; authorization: boolean }[] = []
  const authorizeExecution = async () => true
  await runGuardedCoachSandboxMigrationOperation({
    args: ['--apply'],
    repositoryRoot: process.cwd(),
    authorizeExecution,
    invokeInstalledMigration: async input => {
      calls.push({
        root: input.repositoryRoot,
        url: input.directUrl,
        authorization: await input.authorizeExecution(),
      })
    },
  })
  // Synthetic delegate: never construct a real driver or touch PostgreSQL.
  assert.deepEqual(calls, [{
    root: process.cwd(),
    url: localUrl,
    authorization: true,
  }])
})

test('KAN-598/C14 rejects invalid commands before calling authorization or installed migration coordinator', async () => {
  let approved = false
  let invoked = false
  await assert.rejects(() => runGuardedCoachSandboxMigrationOperation({
    args: ['--apply', '--force'],
    repositoryRoot: process.cwd(),
    authorizeExecution: async () => { approved = true; return true },
    invokeInstalledMigration: async () => { invoked = true },
  }), /argument|operation|explicit/i)
  assert.equal(approved, false)
  assert.equal(invoked, false)
})
