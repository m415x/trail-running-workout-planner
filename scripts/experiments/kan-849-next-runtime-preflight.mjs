#!/usr/bin/env node
// KAN-849: read-only preflight on a disposable worktree's own Next.js runtime.
// Never patch the operator's normal worktree or pnpm global store.
import { createRequire } from 'node:module'
import { readFileSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, relative } from 'node:path'

const root = process.cwd()
const require = createRequire(resolve(root, 'package.json'))
const pkgPath = require.resolve('next/package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const routerPath = require.resolve('next/dist/server/lib/router-utils/resolve-routes')
const nextUrlPath = require.resolve('next/dist/server/web/next-url')
const utilsPath = require.resolve('next/dist/server/web/utils')
const files = [['package', pkgPath], ['resolve-routes', routerPath], ['next-url', nextUrlPath], ['web-utils', utilsPath]]
const sha256 = s => createHash('sha256').update(s).digest('hex')
if (pkg.version !== '16.3.8') throw new Error('Expected baseline Next.js 16.3.8; found ' + pkg.version)
if (root.toLowerCase().includes('node_modules')) throw new Error('Run from a disposable project worktree, not node_modules')
const lines = readFileSync(routerPath, 'utf8').split(/\r?\n/)
const hits = lines.flatMap((line, i) => /initHostname|initUrl|formatHostname|opts\.hostname|proxyRequest|getRelativeURL/.test(line) ? [{line: i + 1, text: line.slice(0, 280)}] : [])
const nextUrl = readFileSync(nextUrlPath, 'utf8')
const utils = readFileSync(utilsPath, 'utf8')
const manifest = {
  repoWorktree: root,
  nextVersion: pkg.version,
  packageLocation: realpathSync(pkgPath),
  upstreamCommit: 'eccedc793c015ad208aa179e58c9f8cee13a39f9',
  files: files.map(([name, p]) => ({name, relativePath: relative(root, p), absolutePath: realpathSync(p), sha256: sha256(readFileSync(p))})),
  routerHits: hits,
  nextUrlHasLoopback: /REGEX_LOCALHOST_HOSTNAME|127\.\(\?:|localhost/.test(nextUrl),
  utilsHasNormalizeLoopbackHostname: utils.includes('normalizeLoopbackHostname'),
}
process.stdout.write('KAN-849 NEXT_RUNTIME_PREFLIGHT ' + JSON.stringify(manifest, null, 2) + '\n')
