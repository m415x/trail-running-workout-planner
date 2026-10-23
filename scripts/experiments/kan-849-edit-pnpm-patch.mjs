#!/usr/bin/env node
// KAN-849/T3 candidate preparation only. Edit pnpm's isolated patch workdir,
// never an installed node_modules package or content-addressable store.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, realpathSync, statSync } from 'node:fs'
import { resolve, join, relative, isAbsolute } from 'node:path'
const root = realpathSync(process.cwd())
const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/experiments/kan-849-edit-pnpm-patch.mjs .tmp/kan-849-pnpm-edit')
const editRoot = realpathSync(resolve(input))
const allowed = resolve(root, '.tmp', 'kan-849-pnpm-edit')
if (editRoot.toLowerCase() !== allowed.toLowerCase()) throw new Error('Refusing edit outside dedicated temporary pnpm patch directory')
if (editRoot.toLowerCase().includes('node_modules') || editRoot.toLowerCase().includes('pnpm-store')) throw new Error('Refusing store or installed runtime modification')
const pkg = JSON.parse(readFileSync(join(editRoot, 'package.json'), 'utf8'))
if (pkg.name !== 'next' || pkg.version !== '16.3.8') throw new Error('Unexpected package identity')
const filename = join(editRoot, 'dist/server/lib/router-utils/resolve-routes.js')
const original = readFileSync(filename)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const originalSha = '95a3614008d21a383a8fd7b97b369a0d0c7a96a0bc806c2b19071ad8647ce962'
const patchedSha = '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3'
if (sha(original) !== originalSha) throw new Error('Unexpected preimage: ' + sha(original))
const anchor = "(0, _formathostname.formatHostname)(opts.hostname || 'localhost')"
const replacement = "(0, _formathostname.formatHostname)(/^(?:127(?:\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|\\[::1\\]|::1|localhost)$/i.test(opts.hostname || 'localhost') ? 'localhost' : (opts.hostname || 'localhost'))"
const text = original.toString('utf8')
if (text.split(anchor).length !== 2) throw new Error('Expected exactly one initUrl anchor')
const patched = Buffer.from(text.replace(anchor, replacement),'utf8')
if (sha(patched) !== patchedSha) throw new Error('Output hash unexpected: '+sha(patched))
writeFileSync(filename,patched)
console.log('KAN-849 PNPM_EDIT_PREPARED '+JSON.stringify({package:'next@16.3.8',relativeFile:'dist/server/lib/router-utils/resolve-routes.js',before:originalSha,after:sha(readFileSync(filename)),upstream:'vercel/next.js#95917',scope:'temporary pnpm patch edit directory'}))
