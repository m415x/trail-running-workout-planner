export type VerifyOptions = { db: boolean; verbose: boolean }
export type VerificationStage = { label: string; command: string }
export type StageExecution = { exitCode: number; output: string; durationMs: number }
export type StageResult = StageExecution & { stage: VerificationStage; success: boolean }
export type VerificationReport = { results: StageResult[]; success: boolean; totalDurationMs: number }

export function parseVerifyOptions(args: string[]): VerifyOptions {
  const options = { db: false, verbose: false }
  for (const arg of args) {
    if (arg === '--db') options.db = true
    else if (arg === '-v' || arg === '--verbose') options.verbose = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

export function verificationStages(db: boolean): VerificationStage[] {
  const stages = [
    { label: 'Tests', command: 'test' },
    { label: 'TypeScript', command: 'tsc' },
    { label: 'ESLint', command: 'lint' },
    { label: 'Build', command: 'build' },
    { label: 'i18n', command: 'i18n:check' },
  ]
  if (db) stages.push({ label: 'SQLite', command: 'db:sqlite:check' })
  return stages
}

export async function runVerification(
  stages: VerificationStage[],
  execute: (stage: VerificationStage) => Promise<StageExecution> | StageExecution,
): Promise<VerificationReport> {
  const results: StageResult[] = []
  for (const stage of stages) {
    const outcome = await execute(stage)
    results.push({ ...outcome, stage, success: outcome.exitCode === 0 })
  }
  return {
    results,
    success: results.every((item) => item.success),
    totalDurationMs: results.reduce((sum, item) => sum + item.durationMs, 0),
  }
}

export function formatVerificationSummary(report: VerificationReport): string {
  const rows = ['Verification summary', '---------------------------------']
  for (const item of report.results) {
    rows.push(`${item.stage.label}  ${item.success ? 'PASS' : 'FAIL'}  ${item.durationMs}ms`)
    if (!item.success) {
      rows.push(`Command: pn ${item.stage.command} (exit ${item.exitCode})`)
      const lines = item.output.split(/\r?\n/).filter(Boolean)
      rows.push(...lines.filter((line) => /not ok|error|fail|✖/i.test(line)).slice(0, 12))
    }
  }
  rows.push(`Result: ${report.success ? 'PASS' : 'FAIL'}`)
  rows.push(`Total: ${report.totalDurationMs}ms`)
  return rows.join('\n')
}
