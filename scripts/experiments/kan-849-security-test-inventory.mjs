#!/usr/bin/env node
// KAN-849 security test discovery: read-only and deterministic. No credentials or DB writes.
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'
const root = process.cwd()
const base = resolve(root, 'tests')
const paths = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (entry.isFile() && ['.test.ts', '.test.tsx', '.test.js', '.test.mjs'].some(s => entry.name.endsWith(s))) paths.push(p)
  }
}
walk(base)
const patterns = [
  ['identity-H2', /KAN-601|KAN-615|H2|identity|supabase.*(claims|subject|auth)/i],
  ['active-team-H3', /KAN-604|KAN-724|KAN-758|active.?team|team.?selection|membership.?revok/i],
  ['authorization-H4A', /KAN-605|H4A|scope.?authorization|permission|authoriz/i],
  ['supabase-cookies', /supabase.?proxy|proxy.?response|carryAuthRefreshIntoResponse|cookie.?refresh|set-cookie/i],
  ['cross-team', /cross.?team|team.?isolation|other.?team|revoked.?membership|forged.?cookie/i],
  ['HTTP-Next', /spawn|next.*dist.*bin.*next|HTTP.*fixture|fetch/i],
]
const rows = []
for (const path of paths) {
  const text = readFileSync(path, 'utf8')
  const name = relative(root, path).replaceAll('\\', '/')
  const categories = patterns.slice(0, -1).filter(([, regex]) => regex.test(name) || regex.test(text)).map(([n]) => n)
  if (!categories.length) continue
  const httpSignals = patterns.at(-1)[1].test(text)
  rows.push({ file: name, categories, possibleHTTP: httpSignals, requiresReview: true })
}
process.stdout.write('KAN-849 SECURITY_TEST_INVENTORY ' + JSON.stringify({ totalTestFiles: paths.length, candidates: rows }, null, 2) + '\\n')
