import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

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

async function waitForServer(base: string, exited: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (exited()) throw new Error('Next.js exited before HTTP readiness; infrastructure failure, not RED')
    try {
      const response = await fetch(base + '/en/login', { redirect: 'manual', signal: AbortSignal.timeout(4000) })
      if (response.status < 500) return
    } catch {
      // The server may still be compiling; retry boundedly.
    }
    await delay(1000)
  }
  throw new Error('Next.js did not become HTTP-ready; infrastructure failure, not RED')
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
  const port = await freePort()
  const base = 'http://127.0.0.1:' + port
  const next = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_TEST_CONTEXT: 'kan-847-isolated-http', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let exited = false
  let diagnostics = ''
  next.on('exit', () => { exited = true })
  next.stdout?.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-8000) })
  next.stderr?.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-8000) })

  try {
    await waitForServer(base, () => exited)
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
    // Include each response and Location/rewrite in the RED failure for causal analysis.
    for (const row of traces) {
      assert.notEqual(row.termination, 'self-redirect', JSON.stringify(row))
      assert.notEqual(row.termination, 'cycle', JSON.stringify(row))
      assert.notEqual(row.termination, 'limit', JSON.stringify(row))
      assert.ok(row.hops.every(h => h.status < 500), JSON.stringify(row))
    }
  } catch (error) {
    if (exited) throw new Error('Next.js failed or exited: ' + diagnostics, { cause: error })
    throw error
  } finally {
    next.kill()
    await Promise.race([new Promise<void>(resolve => next.once('exit', () => resolve())), delay(3000)])
  }
})
