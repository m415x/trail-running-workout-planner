import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const header = readFileSync('features/workouts/components/HomeHeader.tsx', 'utf8')
const hook = readFileSync('features/workouts/hooks/useHomeHeader.ts', 'utf8')

test('KAN-703 Home greeting uses authenticated AthleteProfile identity, not demo user', () => {
  assert.doesNotMatch(hook, /currentUser\s+as\s+user\s+from\s+['"]@\/data\/data['"]/)
  assert.match(header, /athlete\.firstName/)
  assert.match(header, /athlete\.lastName/)
  assert.doesNotMatch(header, /athlete\.nickName\s*\?\?\s*fullName/)
})

test('KAN-703 team avatar fallback also avoids demo identity', () => {
  assert.doesNotMatch(hook, /user\.firstName/)
  assert.doesNotMatch(hook, /user\.lastName/)
})
