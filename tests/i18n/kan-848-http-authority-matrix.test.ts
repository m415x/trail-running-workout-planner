import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

const require = createRequire(import.meta.url)

async function availablePort(): Promise<number> {
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

test('KAN-848/T2 contrasts HTTP request authority with locale rewrite authority', { timeout: 130000 }, async () => {
  const port = await availablePort()
  const base = 'http://127.0.0.1:' + port
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', '0.0.0.0', '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_TEST_CONTEXT: 'kan-848-http-authority', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let exited = false
  let output = ''
  child.on('exit', () => { exited = true })
  child.stdout?.on('data', chunk => { output = (output + String(chunk)).slice(-4000) })
  child.stderr?.on('data', chunk => { output = (output + String(chunk)).slice(-4000) })
  try {
    let ready = false
    for (let i = 0; i < 35; i++) {
      if (exited) throw new Error('Next exited: ' + output)
      try {
        const r = await fetch(base + '/api/kan-848-readiness-probe', { redirect: 'manual', signal: AbortSignal.timeout(3000) })
        if (r.status === 404) { ready = true; break }
      } catch { /* retry boundedly while Next starts */ }
      await delay(1000)
    }
    assert.ok(ready, 'Next HTTP infrastructure did not become ready: ' + output)

    const scenarios = [
      { url: base + '/', host: '127.0.0.1:' + port, cookie: 'es' },
      { url: base + '/', host: 'localhost:' + port, cookie: 'es' },
      { url: 'http://localhost:' + port + '/', host: 'localhost:' + port, cookie: 'es' },
      { url: base + '/dashboard/athletes', host: '127.0.0.1:' + port, cookie: 'es' },
      { url: base + '/dashboard/athletes', host: 'localhost:' + port, cookie: 'es' },
      { url: 'http://localhost:' + port + '/dashboard/athletes', host: 'localhost:' + port, cookie: 'es' },
      { url: base + '/en/dashboard/athletes', host: '127.0.0.1:' + port, cookie: 'en' },
    ]
    const observations = []
    for (const scenario of scenarios) {
      try {
        const r = await fetch(scenario.url, {
          redirect: 'manual',
          headers: { host: scenario.host, cookie: 'NEXT_LOCALE=' + scenario.cookie },
          signal: AbortSignal.timeout(12000),
        })
        observations.push({ ...scenario, status: r.status, location: r.headers.get('location'),
          rewrite: r.headers.get('x-middleware-rewrite') })
      } catch (error) {
        observations.push({ ...scenario, transportError: error instanceof Error ? error.message : String(error) })
      }
    }
    process.stdout.write('KAN-848 HTTP_AUTHORITY_MATRIX ' + JSON.stringify(observations) + '\n')
    const connected = observations.filter(o => 'status' in o)
    assert.ok(connected.length >= 4, 'Insufficient comparable HTTP responses: ' + JSON.stringify(observations))
    assert.ok(connected.every(o => o.status! < 500), 'HTTP server errors: ' + JSON.stringify(observations))
  } finally {
    child.kill()
    await Promise.race([new Promise<void>(resolve => child.once('exit', () => resolve())), delay(3000)])
  }
})
