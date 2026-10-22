import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createHttpDistDir, operatorTypesSnapshot, stopNextHttpServer } from './kan-848-http-fixture'

const require = createRequire(import.meta.url)

type Hop = {
  url: string
  status: number
  location: string | null
  rewrite: string | null
}

async function freePort(): Promise<number> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('No TCP port'))
      server.close(() => resolve(address.port))
    })
  })
}

async function waitForServer(base: string, exited: () => boolean, diagnostics: () => string): Promise<void> {
  let lastObservation = 'No HTTP response yet'
  for (let attempt = 0; attempt < 30; attempt++) {
    if (exited()) throw new Error('Next.js exited before HTTP readiness; infrastructure failure. Logs: ' + diagnostics())
    try {
      const response = await fetch(base + '/api/kan-847-readiness-probe', { redirect: 'manual', signal: AbortSignal.timeout(3000) })
      if (response.status === 404) return
      lastObservation = 'HTTP ' + response.status + ' from /api/kan-847-readiness-probe'
    } catch (error) {
      lastObservation = error instanceof Error ? error.message : String(error)
    }
    await delay(1000)
  }
  throw new Error('Next.js startup/readiness failure (not functional RED): ' + lastObservation + '\\nNext output: ' + diagnostics())
}

async function trace(base: string, pathname: string, cookie: string | null, host: string, maxHops = 6) {
  const hops: Hop[] = []
  let current = new URL(pathname, base).toString()
  const visited = new Set<string>()

  for (let step = 0; step < maxHops; step++) {
    if (visited.has(current)) return { hops, termination: 'cycle' as const }
    visited.add(current)
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        Host: host,
        ...(cookie === null ? {} : { Cookie: 'NEXT_LOCALE=' + cookie }),
      },
      signal: AbortSignal.timeout(12000),
    })
    const location = response.headers.get('location')
    const hop: Hop = {
      url: current,
      status: response.status,
      location,
      rewrite: response.headers.get('x-middleware-rewrite'),
    }
    hops.push(hop)
    if (response.status < 300 || response.status >= 400 || !location) {
      return { hops, termination: 'terminal' as const }
    }
    current = new URL(location, current).toString()
    if (current === hop.url) return { hops, termination: 'self-redirect' as const }
  }
  return { hops, termination: 'limit' as const }
}

test('KAN-847 HTTP RED: Spanish canonical paths terminate without self-redirect or cycle', { timeout: 180000 }, async () => {
  const before = operatorTypesSnapshot()
  const port = await freePort()
  const base = 'http://127.0.0.1:' + port
  const fixture = createHttpDistDir()
  const next = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_TEST_CONTEXT: 'kan-847-isolated-http', NEXT_TELEMETRY_DISABLED: '1', KAN_HTTP_FIXTURE_DIST_DIR: fixture.distDir },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let exited = false
  let diagnostics = ''
  next.on('exit', () => { exited = true })
  next.stdout?.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-8000) })
  next.stderr?.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-8000) })

  try {
    await waitForServer(base, () => exited, () => diagnostics)
    const cases = [
      { path: '/', cookie: 'es', host: '127.0.0.1:' + port },
      { path: '/dashboard/athletes', cookie: 'es', host: '127.0.0.1:' + port },
      { path: '/es/dashboard/athletes', cookie: 'es', host: '127.0.0.1:' + port },
      { path: '/en/dashboard/athletes', cookie: 'en', host: '127.0.0.1:' + port },
      { path: '/dashboard/athletes/profile_user_2/edit', cookie: 'es', host: '127.0.0.1:' + port },
      { path: '/es/dashboard/athletes/profile_user_2/edit', cookie: 'es', host: '127.0.0.1:' + port },
      { path: '/', cookie: null, host: 'localhost:' + port },
      { path: '/', cookie: 'es', host: 'localhost:' + port },
    ]
    const traces = []
    for (const scenario of cases) {
      const result = await trace(base, scenario.path, scenario.cookie, scenario.host)
      traces.push({ scenario, ...result })
    }
    // Report the full bounded matrix before asserting, so the first failing
    // route does not hide other host/locale observations.
    const failures = traces.filter(row =>
      row.termination !== 'terminal' || row.hops.some(h => h.status >= 500))
    if (traces.some(row => row.hops.some(h => h.status >= 500))) {
      process.stdout.write('KAN-849 HTTP_500_SERVER_DIAGNOSTICS ' + JSON.stringify({ diagnostics }) + '\\n')
    }
    assert.equal(failures.length, 0, JSON.stringify({ traces }, null, 2))
  } catch (error) {
    if (exited) throw new Error('Next.js failed or exited: ' + diagnostics, { cause: error })
    throw error
  } finally {
    await stopNextHttpServer(next)
    fixture.cleanup()
    assert.equal(operatorTypesSnapshot(), before, 'HTTP fixture changed operator .next/dev/types')
  }
})
