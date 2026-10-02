import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'
import { resolveProjectSupabaseBinary } from '../../lib/sandbox/supabase-executable'

const root = 'C:\\DEV\\EPT-app\\trail-running-workout-planner'

test('KAN-585 resolves the native optional package through Node module resolution, not a .pnpm version path', () => {
  const installedPackage = join(root, 'node_modules', '.pnpm', 'supabase@2.119.0', 'node_modules', 'supabase')
  const binary = join(root, 'node_modules', '.pnpm', '@supabase+cli-windows-x64@2.119.0', 'node_modules', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe')
  const candidates: string[] = []
  const result = resolveProjectSupabaseBinary({
    repositoryRoot: root,
    platform: 'win32',
    exists: path => { candidates.push(path); return path === binary },
    realpath: path => {
      assert.equal(path, join(root, 'node_modules', 'supabase'))
      return installedPackage
    },
    resolveOptionalBinary: (packageRoot, specifier) => {
      assert.equal(packageRoot, installedPackage)
      assert.equal(specifier, '@supabase/cli-windows-x64/bin/supabase.exe')
      return binary
    },
  })
  assert.equal(result, binary)
  assert.ok(!candidates.some(path => path.endsWith('.cmd')))
})

test('KAN-585 rejects absent optional native package without PATH or .cmd fallback', () => {
  assert.throws(() => resolveProjectSupabaseBinary({
    repositoryRoot: root,
    platform: 'win32',
    exists: () => false,
    realpath: () => join(root, 'node_modules', '.pnpm', 'supabase@2.119.0', 'node_modules', 'supabase'),
    resolveOptionalBinary: () => { throw new Error('password=SECRET') },
  }), (error: unknown) => error instanceof Error
    && /binary|supabase|local/i.test(error.message)
    && !error.message.includes('SECRET'))
})
