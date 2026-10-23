import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = process.cwd()
const require = createRequire(resolve(root, 'package.json'))
const sourceRouter = require.resolve('next/dist/server/lib/router-utils/resolve-routes')
const applyScript = resolve(root, 'scripts/experiments/kan-849-apply-private-router-patch.mjs')
const restoreScript = resolve(root, 'scripts/experiments/kan-849-restore-private-router-patch.mjs')
const expectedOriginal = '95a3614008d21a383a8fd7b97b369a0d0c7a96a0bc806c2b19071ad8647ce962'
const expectedPatched = '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const canonicalBytes = readFileSync(sourceRouter)
assert.equal(hash(canonicalBytes), expectedOriginal, 'Never run fixture tests over a patched runtime')

function fixture(version = '16.3.8', routerBytes = canonicalBytes) {
  const outer = mkdtempSync(join(tmpdir(), 'kan-849-negative-'))
  const cwd = join(outer, 'trail-running-workout-planner-kan-849-exp')
  const router = join(cwd, 'node_modules', 'next', 'dist', 'server', 'lib', 'router-utils', 'resolve-routes.js')
  mkdirSync(dirname(router), { recursive: true })
  writeFileSync(join(cwd, 'package.json'), '{"private":true,"name":"kan-849-fixture"}\n')
  writeFileSync(join(cwd, 'node_modules', 'next', 'package.json'), JSON.stringify({name:'next',version}))
  writeFileSync(router, routerBytes)
  return {cwd,router,backup:join(cwd,'.tmp','kan-849-router-original.js'),cleanup:()=>rmSync(outer,{recursive:true,force:true})}
}
function run(script,cwd) {
  const result = spawnSync(process.execPath,[script],{cwd,encoding:'utf8',windowsHide:true,timeout:15000})
  assert.equal(result.error,undefined,'Child process must start and exit')
  return result
}
function fail(result,reason) {
  assert.notEqual(result.status,0,reason)
  assert.ok(result.stderr.includes('Error:')||result.stderr.includes('refusing')||result.stderr.includes('mismatch'),reason+': expected explicit failure')
}
function unchanged(router,bytes=canonicalBytes) {
  assert.equal(hash(readFileSync(router)),hash(bytes),'Router bytes must remain unchanged')
}

test('KAN-849 private patch refuses wrong Next version without writing', () => {
  const f=fixture('16.3.9')
  try {
    fail(run(applyScript,f.cwd),'Version mismatch')
    unchanged(f.router)
    assert.equal(existsSync(f.backup),false)
  } finally { f.cleanup() }
})
test('KAN-849 private patch refuses unexpected preimage without writing', () => {
  const bytes=Buffer.from('not-an-approved-next-runtime')
  const f=fixture('16.3.8',bytes)
  try {
    fail(run(applyScript,f.cwd),'Preimage mismatch')
    unchanged(f.router,bytes)
    assert.equal(existsSync(f.backup),false)
  } finally { f.cleanup() }
})
test('KAN-849 private patch fails safely when temporary target already exists', () => {
  const f=fixture()
  try {
    const temp=f.router+'.kan-849-private-write'
    writeFileSync(temp,'occupied')
    fail(run(applyScript,f.cwd),'Write collision')
    unchanged(f.router)
    assert.equal(existsSync(f.backup),false,'Failed apply must not leave a misleading backup')
    // A failed operation must not modify the canonical router; collision file
    // may be cleaned by script and does not belong to the canonical runtime.
  } finally { f.cleanup() }
})
test('KAN-849 restore refuses unknown installed router and preserves backup', () => {
  const f=fixture()
  try {
    assert.equal(run(applyScript,f.cwd).status,0,'Apply fixture must succeed')
    assert.equal(hash(readFileSync(f.router)),expectedPatched)
    const unknown=Buffer.from('third-party-router-change')
    writeFileSync(f.router,unknown)
    fail(run(restoreScript,f.cwd),'Unexpected installed hash')
    unchanged(f.router,unknown)
    assert.equal(existsSync(f.backup),true)
    writeFileSync(f.router,canonicalBytes.length ? readFileSync(f.backup) : canonicalBytes)
    assert.equal(run(restoreScript,f.cwd).status,0,'Idempotent restored baseline must be accepted')
    unchanged(f.router)
    assert.equal(existsSync(f.backup),false)
  } finally { f.cleanup() }
})
test('KAN-849 fixture apply/restore never mutates real Next runtime', () => {
  const before=hash(readFileSync(sourceRouter))
  const real=realpathSync(sourceRouter)
  const beforeLinks=statSync(sourceRouter).nlink
  const f=fixture()
  try {
    assert.equal(run(applyScript,f.cwd).status,0)
    assert.equal(hash(readFileSync(f.router)),expectedPatched)
    assert.equal(run(restoreScript,f.cwd).status,0)
    unchanged(f.router)
    assert.equal(hash(readFileSync(sourceRouter)),before)
    assert.equal(realpathSync(sourceRouter),real)
    assert.equal(statSync(sourceRouter).nlink,beforeLinks)
  } finally { f.cleanup() }
  process.stdout.write('KAN-849 PRIVATE_PATCH_NEGATIVE_GREEN '+JSON.stringify({
    versionRejected:true,preimageRejected:true,writeCollisionSafe:true,
    unknownRollbackRejected:true,realRuntimeUnchanged:true,
    note:'Fixture isolation verifies real runtime unchanged; pnpm store-wide audit remains separate',
  })+'\n')
})
