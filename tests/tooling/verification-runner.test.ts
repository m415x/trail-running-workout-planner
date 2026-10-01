import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseVerifyOptions,
  verificationStages,
  runVerification,
  formatVerificationSummary,
} from '@/scripts/verify'

describe('KAN-568 integral verification runner', () => {
  it('selects only the five local gates by default and adds SQLite checks solely with --db', () => {
    assert.deepEqual(parseVerifyOptions([]), { db: false, verbose: false })
    assert.deepEqual(parseVerifyOptions(['--db', '-v']), { db: true, verbose: true })
    assert.deepEqual(parseVerifyOptions(['--verbose']), { db: false, verbose: true })
    assert.deepEqual(verificationStages(false).map((stage) => stage.command), [
      'test', 'tsc', 'lint', 'build', 'i18n:check',
    ])
    assert.deepEqual(verificationStages(true).map((stage) => stage.command), [
      'test', 'tsc', 'lint', 'build', 'i18n:check', 'db:sqlite:check',
    ])
    assert.throws(() => parseVerifyOptions(['--supabase']), /Unknown option/)
    assert.throws(() => parseVerifyOptions(['--db', '--unsafe']), /Unknown option/)
  })

  it('runs every selected gate, records timings and reports failures with nonzero exit', async () => {
    const observed: string[] = []
    const report = await runVerification(
      verificationStages(false),
      async (stage) => {
        observed.push(stage.command)
        return stage.command === 'test'
          ? { exitCode: 1, output: 'not ok 42 - broken contract\\nerror: expected true', durationMs: 125 }
          : { exitCode: 0, output: '', durationMs: 25 }
      },
    )
    assert.deepEqual(observed, ['test', 'tsc', 'lint', 'build', 'i18n:check'])
    assert.equal(report.success, false)
    assert.equal(report.totalDurationMs, 225)
    const summary = formatVerificationSummary(report)
    assert.match(summary, /FAIL[\\s\\S]*125/)
    assert.match(summary, /broken contract/)
    assert.match(summary, /Result: FAIL/)
    assert.doesNotMatch(summary, /\\bResult: PASS\\b/)
  })

  it('produces a successful summary when all selected gates pass', async () => {
    const report = await runVerification(
      verificationStages(true),
      async () => ({ exitCode: 0, output: '', durationMs: 5 }),
    )
    assert.equal(report.success, true)
    assert.equal(report.results.length, 6)
    assert.match(formatVerificationSummary(report), /SQLite[\\s\\S]*PASS/)
    assert.match(formatVerificationSummary(report), /Result: PASS/)
  })
})
