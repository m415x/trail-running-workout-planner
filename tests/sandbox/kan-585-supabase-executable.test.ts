import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'

import { resolveProjectSupabaseBinary } from '../../lib/sandbox/supabase-executable'

const root = 'C:\\DEV\\EPT-app\\trail-running-workout-planner'

test('KAN-585 selects the project-local native Windows executable, never a cmd shim', () => {
  const visited: string[] = []
  const expected = join(root, 'node_modules', 'supabase', 'bin', 'supabase.exe')
  const result = resolveProjectSupabaseBinary({
    repositoryRoot: root,
    platform: 'win32',
    exists: (path) => { visited.push(path); return path === expected },
  })
  assert.equal(result, expected)
  assert.deepEqual(visited, [expected])
  assert.equal(result.endsWith('.cmd'), false)
})

test('KAN-585 uses project-local binary on non-Windows platforms', () => {
  const expected = join('/workspace/project', 'node_modules', 'supabase', 'bin', 'supabase')
  assert.equal(resolveProjectSupabaseBinary({
    repositoryRoot: '/workspace/project',
    platform: 'linux',
    exists: (path) => path === expected,
  }), expected)
})

test('KAN-585 fails closed when native executable is absent and never falls back to PATH or pnpm shims', () => {
  assert.throws(() => resolveProjectSupabaseBinary({
    repositoryRoot: root,
    platform: 'win32',
    exists: () => false,
  }), /local|binary|supabase/i)
})
