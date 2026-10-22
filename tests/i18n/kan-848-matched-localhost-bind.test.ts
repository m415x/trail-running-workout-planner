import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createHttpDistDir, operatorTypesSnapshot, operatorConfigSnapshot, stopNextHttpServer } from './kan-848-http-fixture'

const require = createRequire(import.meta.url)

async function port(): Promise<number> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') return reject(new Error('Port unavailable'))
      server.close(() => resolve(addr.port))
    })
  })
}

test('KAN-848/T2 checks matched localhost bind against loopback-host mismatch', { timeout: 120000 }, async () => {
  const before = operatorTypesSnapshot()
  const configBefore = operatorConfigSnapshot()
  const fixture = createHttpDistDir()
  const n = await port()
  const base = 'http://localhost:' + n
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', 'localhost', '-p', String(n)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_TEST_CONTEXT: 'kan-848-localhost-bind', NEXT_TELEMETRY_DISABLED: '1', KAN_HTTP_FIXTURE_DIST_DIR: fixture.distDir, KAN_HTTP_FIXTURE_TSCONFIG: fixture.tsconfigPath },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let exited = false
  let logs = ''
  child.on('exit', () => { exited = true })
  child.stdout?.on('data', c => { logs = (logs + String(c)).slice(-4500) })
  child.stderr?.on('data', c => { logs = (logs + String(c)).slice(-4500) })
  try {
    let ready = false
    for (let attempt = 0; attempt < 30; attempt++) {
      if (exited) throw new Error('Next exited: ' + logs)
      try {
        const response = await fetch(base + '/api/kan-848-readiness-probe', { redirect: 'manual', signal: AbortSignal.timeout(3000) })
        if (response.status === 404) { ready = true; break }
      } catch { /* bounded startup retry */ }
      await delay(1000)
    }
    assert.ok(ready, 'Next localhost readiness failed: ' + logs)
    const results = []
    for (const path of ['/', '/dashboard/athletes']) {
      const response = await fetch(base + path, {
        redirect: 'manual', headers: { cookie: 'NEXT_LOCALE=es' },
        signal: AbortSignal.timeout(12000),
      })
      results.push({ path, status: response.status, location: response.headers.get('location'), rewrite: response.headers.get('x-middleware-rewrite') })
    }
    process.stdout.write('KAN-848 MATCHED_LOCALHOST_BIND_MATRIX ' + JSON.stringify(results) + '\n')
    assert.equal(results.length, 2)
    assert.ok(results.every(r => r.status < 500), JSON.stringify(results))
  } finally {
    await stopNextHttpServer(child)
    fixture.cleanup()
    assert.equal(operatorTypesSnapshot(), before, 'HTTP test contaminated operator .next/dev/types')
    assert.equal(operatorConfigSnapshot(), configBefore, 'HTTP test contaminated operator tsconfig.json')
  }
})
