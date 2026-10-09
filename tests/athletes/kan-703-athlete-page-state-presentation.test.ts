import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('app/[locale]/(mobile)/page.tsx', 'utf8')
const plan = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')
const componentPath = 'features/athlete-planning/components/AthletePageState.tsx'

test('KAN-703 Home and Plan use one shared accessible athlete page-state component', () => {
  assert.match(home, /import \{ AthletePageState \} from/)
  assert.match(plan, /import \{ AthletePageState \} from/)
  assert.match(home, /<AthletePageState message=\{tPlan\('unauthorized'\)\}/)
  assert.match(plan, /<AthletePageState message=\{/)
  const component = readFileSync(componentPath, 'utf8')
  assert.match(component, /role='alert'/)
  assert.match(component, /max-w-5xl/)
  assert.match(component, /text-destructive/)
})

test('KAN-703 Home keeps error and DENY distinct without full-screen custom styling', () => {
  assert.match(home, /tPlan\('unauthorized'\)/)
  assert.match(home, /t\('errors\.saveFailed'\)/)
  assert.doesNotMatch(home, /h-screen items-center justify-center p-4 text-center text-red-500/)
  assert.doesNotMatch(home, /min-h-\[60dvh\] items-center justify-center/)
})
