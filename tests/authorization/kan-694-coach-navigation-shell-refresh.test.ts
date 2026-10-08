import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const shell = readFileSync('app/[locale]/dashboard/DashboardShell.tsx', 'utf8')

test('KAN-694 DashboardShell installs browser resume listener for a fresh server navigation projection', () => {
  assert.match(shell, /createCoachNavigationResumeRefresh/)
  assert.match(shell, /router\.refresh\(\)/)
  assert.match(shell, /document\.addEventListener\('visibilitychange'/)
  assert.match(shell, /window\.addEventListener\('focus'/)
})

test('KAN-694 removes browser listeners when shell unmounts to avoid stale sessions', () => {
  assert.match(shell, /document\.removeEventListener\('visibilitychange'/)
  assert.match(shell, /window\.removeEventListener\('focus'/)
})
