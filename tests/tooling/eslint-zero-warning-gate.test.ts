import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { runVerification, verificationStages } from '../../scripts/verify'

test('canonical pn lint fails on any ESLint warning', () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }

  assert.match(
    packageJson.scripts.lint,
    /(?:^|\s)--max-warnings(?:=|\s+)0(?:\s|$)/,
    'pn lint must invoke ESLint with a zero-warning budget',
  )
})

test('verify and verify --db propagate nonzero lint exit codes', async () => {
  for (const db of [false, true]) {
    const report = await runVerification(verificationStages(db), (stage) => ({
      exitCode: stage.command === 'lint' ? 1 : 0,
      output: stage.command === 'lint' ? 'ESLint found warnings' : '',
      durationMs: 1,
    }))

    assert.equal(report.success, false)
    assert.equal(report.results.find((item) => item.stage.command === 'lint')?.success, false)
  }
})
