#!/usr/bin/env node
// KAN-849: restore exact baseline bytes in the dedicated experimental worktree.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
const root = process.cwd()
if (!root.toLowerCase().endsWith('trail-running-workout-planner-kan-849-exp')) {
  throw new Error('Refusing to restore outside the dedicated experimental worktree')
}
const require = createRequire(resolve(root, 'package.json'))
const routerPath = require.resolve('next/dist/server/lib/router-utils/resolve-routes')
if (!realpathSync(routerPath).startsWith(root + '\\') && !realpathSync(routerPath).startsWith(root + '/')) throw new Error('Unexpected external runtime path')
const backup = resolve(root, '.tmp/kan-849-router-original.js')
if (!existsSync(backup)) throw new Error('Baseline backup absent; nothing restored')
const expected = '95a3614008d21a383a8fd7b97b369a0d0c7a96a0bc806c2b19071ad8647ce962'
const expectedPatched = '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const bytes = readFileSync(backup)
if (hash(bytes) !== expected) throw new Error('Baseline backup SHA mismatch; refusing restore')
const installedHash = hash(readFileSync(routerPath))
if (installedHash !== expectedPatched && installedHash !== expected) {
  throw new Error('Unexpected installed router SHA; refusing to overwrite unrelated modifications: ' + installedHash)
}
if (installedHash === expected) {
  unlinkSync(backup)
  process.stdout.write('KAN-849 UPSTREAM_PATCH_RESTORED ' + JSON.stringify({sha256: expected, target: routerPath, alreadyOriginal:true}) + '\n')
  process.exit(0)
}
const temp = routerPath + '.kan-849-restore-private'
writeFileSync(temp, bytes, { flag: 'wx' })
try { renameSync(temp, routerPath) } catch (err) { try { unlinkSync(temp) } catch {} throw err }
if (hash(readFileSync(routerPath)) !== expected) throw new Error('Restore verification failed')
unlinkSync(backup)
process.stdout.write('KAN-849 UPSTREAM_PATCH_RESTORED ' + JSON.stringify({ sha256: expected, target: routerPath }) + '\n')
