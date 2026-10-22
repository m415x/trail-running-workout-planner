#!/usr/bin/env node
// KAN-849 isolated experiment only. Adaptation of vercel/next.js@eccedc793c015ad208aa179e58c9f8cee13a39f9.
// Upstream normalizes the bound loopback hostname before constructing initUrl.
// Here we apply that behavior to the distributed JS of exactly Next 16.3.8,
// without changing NextURL or other routing semantics.
// Run ONLY in trail-running-workout-planner-kan-849-exp after baseline RED.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, statSync, unlinkSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
if (!root.toLowerCase().endsWith('trail-running-workout-planner-kan-849-exp')) {
  throw new Error('Refusing to patch outside the dedicated KAN-849 experimental worktree')
}
const require = createRequire(resolve(root, 'package.json'))
const pkgPath = require.resolve('next/package.json')
const routerPath = require.resolve('next/dist/server/lib/router-utils/resolve-routes')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
if (pkg.version !== '16.3.8') throw new Error('Not baseline Next.js 16.3.8')
if (!realpathSync(routerPath).startsWith(root + '\\') && !realpathSync(routerPath).startsWith(root + '/')) {
  throw new Error('Resolved router is outside the disposable worktree')
}

const expectedSha = '95a3614008d21a383a8fd7b97b369a0d0c7a96a0bc806c2b19071ad8647ce962'
const before = readFileSync(routerPath)
const hash = s => createHash('sha256').update(s).digest('hex')
if (hash(before) !== expectedSha) throw new Error('Preimage SHA mismatch; refusing experimental patch: ' + hash(before))
const oldText = "(0, _formathostname.formatHostname)(opts.hostname || 'localhost')"
const replacement = "(0, _formathostname.formatHostname)(/^(?:127(?:\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|\\[::1\\]|::1|localhost)$/i.test(opts.hostname || 'localhost') ? 'localhost' : (opts.hostname || 'localhost'))"
const original = before.toString('utf8')
const matches = original.split(oldText).length - 1
if (matches !== 1) throw new Error('Expected exactly one upstream initUrl anchor; found ' + matches)
const patched = Buffer.from(original.replace(oldText, replacement), 'utf8')
const backup = resolve(root, '.tmp/kan-849-router-original.js')
const temp = routerPath + '.kan-849-private-write'
const baselineStat = statSync(routerPath)
if (baselineStat.nlink > 1) {
  // Safe atomic replacement breaks any pnpm hardlink before writing the new bytes.
  // Never writeFileSync(routerPath, ...) directly.
}
writeFileSync(backup, before, { flag: 'wx' })
try {
  writeFileSync(temp, patched, { flag: 'wx', mode: baselineStat.mode })
  renameSync(temp, routerPath)
} catch (error) {
  try { unlinkSync(temp) } catch {}
  throw error
}
process.stdout.write('KAN-849 UPSTREAM_PATCH_APPLIED ' + JSON.stringify({
  upstream: 'vercel/next.js@eccedc793c015ad208aa179e58c9f8cee13a39f9',
  target: routerPath, baselineSha256: hash(before), patchedSha256: hash(readFileSync(routerPath)),
  replacements: matches, hardlinksBefore: baselineStat.nlink, backup,
  deviation: 'Inline compiled JS equivalent of upstream loopback normalization, only for initUrl',
}) + '\n')
