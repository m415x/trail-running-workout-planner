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
      if (!address || typeof address === 'string') return reject(new Error('No TCP port'))
      server.close(() => resolve(address.port))
    })
  })
}
async function inspect(bindHost: '127.0.0.1' | 'localhost') {
  const port = await freePort()
  const fixture = createHttpDistDir()
  const base = 'http://' + bindHost + ':' + port
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', bindHost, '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', KAN_HTTP_FIXTURE_DIST_DIR: fixture.distDir, KAN_HTTP_FIXTURE_TSCONFIG: fixture.tsconfigPath, KAN_HTTP_FIXTURE_DIAGNOSTICS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let exited = false
  let logs = ''
  child.on('exit', () => { exited = true })
  child.stdout?.on('data', chunk => { logs += String(chunk) })
  child.stderr?.on('data', chunk => { logs += String(chunk) })
  try {
    let ready = false
    for (let attempt = 0; attempt < 30; attempt++) {
      if (exited) throw new Error('Next exited: ' + logs.slice(-3500))
      try {
        const r = await fetch(base + '/api/kan-849-reentry-ready', { redirect: 'manual', signal: AbortSignal.timeout(3000) })
        if (r.status === 404) { ready = true; break }
      } catch { /* startup is bounded */ }
      await delay(1000)
    }
    assert.ok(ready, 'Next failed readiness: ' + logs.slice(-3500))
    // Do not follow a public redirect: inspect the internal reentry from a single initial fetch.
    const rows = []
    const perRequestEntries: { path: string; entries: { url: string; host: string | null; invocation: number }[] }[] = []
    const address = bindHost === 'localhost' ? 'localhost' : '127.0.0.1'
    for (const path of ['/', '/dashboard/athletes', '/es/dashboard/athletes', '/en/dashboard/athletes']) {
      await delay(40)
      const beforeRequest = logs.length
      const r = await fetch('http://' + address + ':' + port + path, {
        redirect: 'manual', headers: { host: address + ':' + port, cookie: 'NEXT_LOCALE=' + (path.startsWith('/en/') ? 'en' : 'es') }, signal: AbortSignal.timeout(15000),
      })
      rows.push({ path, status: r.status, location: r.headers.get('location'), rewrite: r.headers.get('x-middleware-rewrite') })
      await delay(100)
      const entries = logs.slice(beforeRequest).split(/\r?\n/)
        .filter(line => line.startsWith('KAN-849 PROXY_STAGE '))
        .map(line => JSON.parse(line.slice('KAN-849 PROXY_STAGE '.length)))
        .filter(stage => stage.stage === 'entry')
        .map(stage => ({ url: stage.url as string, host: stage.host as string | null, invocation: stage.invocation as number }))
      perRequestEntries.push({ path, entries })
    }
    const stages = logs.split(/\r?\n/).filter(line => line.startsWith('KAN-849 PROXY_STAGE ')).map(line => JSON.parse(line.slice('KAN-849 PROXY_STAGE '.length)))
    process.stdout.write('KAN-849 REENTRY_BIND_MATRIX ' + JSON.stringify({ bindHost, rows, perRequestEntries, stages }) + '\n')
    assert.equal(rows.length, 4)
    assert.ok(stages.some(stage => stage.stage === 'after-intl'), 'No intl stage captured')
    assert.ok(stages.some(stage => stage.stage === 'after-auth-carry'), 'No post-auth stage captured')
    return { rows, stages, perRequestEntries }
  } finally {
    await stopNextHttpServer(child)
    fixture.cleanup()
  }
}

test('KAN-849/T3 characterizes internal Spanish proxy reentry under matched bind controls', { timeout: 180000 }, async () => {
  const typesBefore = operatorTypesSnapshot()
  const configBefore = operatorConfigSnapshot()
  try {
    const loopback = await inspect('127.0.0.1')
    const localhost = await inspect('localhost')
    assert.ok(loopback.stages.length > 0 && localhost.stages.length > 0)
    for (const result of [loopback, localhost]) {
      const bindHost = result === loopback ? '127.0.0.1' : 'localhost'
      const direct = result.perRequestEntries.find(row => row.path === '/es/dashboard/athletes')
      const unprefixed = result.perRequestEntries.find(row => row.path === '/dashboard/athletes')
      assert.ok(direct && unprefixed)
      assert.equal(direct.entries.length, 1, 'Public /es/... must invoke proxy once: ' + JSON.stringify({ bindHost, direct }))
      assert.equal(direct.entries[0].host?.split(':')[0], bindHost, 'Public /es/... must retain original Host')
      assert.equal(unprefixed.entries.length, 1, 'Unprefixed ES must not trigger internal proxy reentry: ' + JSON.stringify({ bindHost, unprefixed }))
      assert.equal(unprefixed.entries[0].host?.split(':')[0], bindHost, 'Original external Host must be preserved')
      assert.ok(!unprefixed.entries.some(entry => entry.url.includes('/es/dashboard/athletes') && entry.host?.startsWith('localhost:')), 'No internal localhost canonicalization on ES rewrite')
    }
  } finally {
    assert.equal(operatorTypesSnapshot(), typesBefore, 'Operator Next types changed')
    assert.equal(operatorConfigSnapshot(), configBefore, 'Operator tsconfig changed')
  }
})
