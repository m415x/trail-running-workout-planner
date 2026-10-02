import assert from 'node:assert/strict'
import test from 'node:test'
import { dirname, join } from 'node:path'
import { resolveProjectSupabaseBinary } from '../../lib/sandbox/supabase-executable'

const root = 'C:\\DEV\\EPT-app\\trail-running-workout-planner'

test('KAN-585 finds pnpm-linked native Windows CLI package without scanning .pnpm versions', () => {
  const installedPackage = join(root, 'node_modules', '.pnpm', 'supabase@2.119.0', 'node_modules', 'supabase')
  const binary = join(dirname(installedPackage), '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe')
  const candidates: string[] = []

  const result = resolveProjectSupabaseBinary({
    repositoryRoot: root,
    platform: 'win32',
    exists: path => { candidates.push(path); return path === binary },
    realpath: path => {
      assert.equal(path, join(root, 'node_modules', 'supabase'))
      return installedPackage
    },
  })
  assert.equal(result, binary)
  assert.ok(!candidates.some(path => path.endsWith('.cmd')))
})

test('KAN-585 rejects an absent pnpm optional binary without returning a shim or PATH executable', () => {
  assert.throws(() => resolveProjectSupabaseBinary({
    repositoryRoot: root,
    platform: 'win32',
    exists: () => false,
    realpath: () => join(root, 'node_modules', '.pnpm', 'supabase@2.119.0', 'node_modules', 'supabase'),
  }), /binary|supabase|local/i)
})
