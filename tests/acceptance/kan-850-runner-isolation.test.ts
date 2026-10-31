import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { discoverTestFiles, partitionTestFiles } from '../../scripts/test-runner'

test('KAN-850: ordinary runner discovers pure oracle tests and excludes sibling external acceptance executors', async () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'kan850-runner-isolation-'))
  try {
    const testsRoot = join(sandbox, 'tests')
    const externalRoot = join(sandbox, 'scripts', 'acceptance', 'kan-850')
    mkdirSync(testsRoot, { recursive: true })
    mkdirSync(externalRoot, { recursive: true })

    const pure = join(testsRoot, 'kan-850-response-oracles.test.ts')
    const external = join(externalRoot, 'kan-850-real-supabase.test.ts')
    writeFileSync(pure, "import test from 'node:test'\ntest('pure', () => {})\n")
    writeFileSync(external, "import test from 'node:test'\ntest('external', () => {})\n")

    const discovered = await discoverTestFiles(testsRoot)
    const lanes = await partitionTestFiles(discovered)

    assert.deepEqual(discovered, [pure])
    assert.deepEqual(lanes.ordinary, [pure])
    assert.deepEqual(lanes.postgres, [])
    assert.ok(!discovered.includes(external))
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})
