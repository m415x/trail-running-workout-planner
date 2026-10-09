import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/[locale]/(mobile)/plan/page.tsx', 'utf8')

test('KAN-703 Plan header allows the title column to shrink alongside group badge', () => {
  assert.match(page, /min-w-0/)
  assert.match(page, /shrink-0/)
})

test('KAN-703 competition action wraps or stacks at 320 px', () => {
  assert.match(page, /flex-col\s+.*sm:flex-row|flex-wrap|grid-cols-1\s+.*sm:grid-cols-2/)
  assert.match(page, /viewRegistrations/)
})
