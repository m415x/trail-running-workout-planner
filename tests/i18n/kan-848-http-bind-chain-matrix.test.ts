import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createHttpDistDir, operatorTypesSnapshot, operatorConfigSnapshot, stopNextHttpServer } from './kan-848-http-fixture'

const require = createRequire(import.meta.url)

async function freePort(): Promise<number> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('No port'))
      server.close(() => resolve(address.port))
    })
  })
}

async function trace(start: string, host: string, maxHops = 6) {
  const seen = new Set<string>()
  const hops = []
  let url = start
  for (let i = 0; i < maxHops; i++) {
    if (seen.has(url)) return { hops, termination: 'cycle' }
    seen.add(url)
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { host, cookie: 'NEXT_LOCALE=es' },
      signal: AbortSignal.timeout(12000),
    })
    const location = response.headers.get('location')
    hops.push({
      url, status: response.status, location,
      rewrite: response.headers.get('x-middleware-rewrite'),
    })
    if (!location || response.status < 300 || response.status >= 400) {
      return { hops, termination: 'terminal' }
    }
    const next = new URL(location, url).toString()
    if (next === url) return { hops, termination: 'self-redirect' }
    url = next
  }
  return { hops, termination: 'limit' }
}

async function inspect(bindHost: string) {
  const port = await freePort()
  const base = 'http://127.0.0.1:' + port
  const fixture = createHttpDistDir()
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', bindHost, '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_TEST_CONTEXT: 'kan-848-http-bind-matrix', NEXT_TELEMETRY_DISABLED: '1', KAN_HTTP_FIXTURE_DIST_DIR: fixture.distDir, KAN_HTTP_FIXTURE_TSCONFIG: fixture.tsconfigPath },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let exited = false
  let output = ''
  child.on('exit', () => { exited = true })
  child.stdout?.on('data', chunk => { output = (output + String(chunk)).slice(-6000) })
  child.stderr?.on('data', chunk => { output = (output + String(chunk)).slice(-6000) })
  try {
    let ready = false
    for (let attempt = 0; attempt < 30; attempt++) {
      if (exited) throw new Error('Next exited: ' + output)
      try {
        const response = await fetch(base + '/api/kan-848-bind-readiness', {
          redirect: 'manual', signal: AbortSignal.timeout(3000),
        })
        if (response.status === 404) { ready = true; break }
      } catch { /* bounded startup retry */ }
      await delay(1000)
    }
    assert.ok(ready, 'Next HTTP readiness failed: ' + output)
    const cases = []
    for (const host of ['127.0.0.1:' + port, 'localhost:' + port]) {
      for (const path of ['/', '/dashboard/athletes', '/es/dashboard/athletes']) {
        cases.push({ bindHost, host, path, ...(await trace(base + path, host)) })
      }
    }
    return cases
  } finally {
    await stopNextHttpServer(child)
    fixture.cleanup()
  }
}

test('KAN-848/T2 contrasts binding and complete ES redirect chains over real HTTP', { timeout: 180000 }, async () => {
  const before = operatorTypesSnapshot()
  const configBefore = operatorConfigSnapshot()
  const rows = [...await inspect('127.0.0.1'), ...await inspect('0.0.0.0')]
  assert.equal(operatorTypesSnapshot(), before, 'HTTP fixture changed operator .next/dev/types')
  assert.equal(operatorConfigSnapshot(), configBefore, 'HTTP fixture changed operator tsconfig.json')
  process.stdout.write('KAN-848 HTTP_BIND_CHAIN_MATRIX ' + JSON.stringify(rows) + '\n')
  assert.equal(rows.length, 12)
  for (const row of rows) {
    assert.ok(row.hops.length >= 1, JSON.stringify(row))
    assert.ok(row.hops.every(h => h.status < 500), JSON.stringify(row))
  }
  // This is a diagnostic observation, not a production behavior contract.
  // Do not assert an assumed cause or a production fix from correlations.
})
