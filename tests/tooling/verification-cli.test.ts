import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { runVerifyCli } from '@/scripts/verify-cli'

const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))

describe('KAN-568 verify CLI wiring', () => {
  it('exposes pn verify without modifying the tdd scripts', () => {
    assert.equal(packageJson.scripts.verify, 'tsx scripts/verify-cli.ts')
    assert.equal(packageJson.scripts.tdd, 'tsx scripts/tdd.ts')
    assert.equal(packageJson.scripts['tdd:red'], 'tsx scripts/tdd.ts --red')
  })

  it('executes selected stages sequentially, includes SQLite with --db and returns nonzero on failure', async () => {
    const calls: string[] = []
    const lines: string[] = []
    const result = await runVerifyCli(['--db'], {
      execute: async (stage) => {
        calls.push(stage.command)
        return { exitCode: stage.command === 'lint' ? 2 : 0, durationMs: 3, output: stage.command === 'lint' ? 'error: invalid rule' : '' }
      },
      write: (line) => lines.push(line),
    })
    assert.equal(result, 1)
    assert.deepEqual(calls, ['test', 'tsc', 'lint', 'build', 'i18n:check', 'db:sqlite:check'])
    assert.match(lines.join(''), /Result: FAIL/)
    assert.match(lines.join(''), /error: invalid rule/)
    assert.match(lines.join(''), /SQLite\s+PASS/)
  })

  it('propagates verbose mode and reports unknown options without running stages', async () => {
    const verbose: boolean[] = []
    const lines: string[] = []
    const status = await runVerifyCli(['-v'], {
      execute: async (_stage, verboseEnabled) => {
        verbose.push(verboseEnabled)
        return { exitCode: 0, durationMs: 1, output: '' }
      },
      write: (text) => lines.push(text),
    })
    assert.equal(status, 0)
    assert.equal(verbose.length, 5)
    assert.ok(verbose.every(Boolean))
    assert.match(lines.join(''), /Result: PASS/)

    let called = false
    const usage: string[] = []
    const badStatus = await runVerifyCli(['--supabase'], {
      execute: async () => {
        called = true
        return { exitCode: 0, durationMs: 1, output: '' }
      },
      write: (text) => usage.push(text),
    })
    assert.equal(badStatus, 2)
    assert.equal(called, false)
    assert.match(usage.join(''), /Unknown option: --supabase/)
  })
})
