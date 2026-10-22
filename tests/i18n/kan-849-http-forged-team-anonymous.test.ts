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

test('KAN-849/T3 HTTP anonymous forged Active-Team cookie cannot override H2 login redirects', { timeout: 120000 }, async () => {
  const typesBefore = operatorTypesSnapshot()
  const configBefore = operatorConfigSnapshot()
  const port = await freePort()
  const fixture = createHttpDistDir()
  const base = 'http://127.0.0.1:' + port
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      KAN_HTTP_FIXTURE_DIST_DIR: fixture.distDir,
      KAN_HTTP_FIXTURE_TSCONFIG: fixture.tsconfigPath,
      KAN_HTTP_FIXTURE_DIAGNOSTICS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let logs = ''
  let exited = false
  child.on('exit', () => { exited = true })
  child.stdout?.on('data', chunk => { logs += String(chunk) })
  child.stderr?.on('data', chunk => { logs += String(chunk) })
  try {
    let ready = false
    for (let n = 0; n < 30; n++) {
      if (exited) throw new Error('Next exited: ' + logs.slice(-2000))
      try {
        const response = await fetch(base + '/api/kan-849-security-readiness', { redirect: 'manual', signal: AbortSignal.timeout(3000) })
        if (response.status === 404) { ready = true; break }
      } catch { /* bounded startup */ }
      await delay(1000)
    }
    assert.ok(ready, 'Next HTTP startup: ' + logs.slice(-2000))

    const observations: Array<{ path: string; locale: string; status: number; location: string | null; entries: number }> = []
    const scenarios = [
      { path: '/dashboard/athletes', locale: 'es', expected: '/es/login?' },
      { path: '/en/dashboard/athletes', locale: 'en', expected: '/en/login?' },
    ]
    for (const scenario of scenarios) {
      const beforeRequest = logs.length
      const response = await fetch(base + scenario.path, {
        redirect: 'manual',
        headers: {
          host: '127.0.0.1:' + port,
          cookie: 'NEXT_LOCALE=' + scenario.locale + '; ept_active_team=team-forged',
        },
        signal: AbortSignal.timeout(15000),
      })
      await delay(100)
      const entries = logs.slice(beforeRequest).split(/\r?\n/)
        .filter(line => line.startsWith('KAN-849 PROXY_STAGE '))
        .map(line => JSON.parse(line.slice('KAN-849 PROXY_STAGE '.length)))
        .filter(stage => stage.stage === 'entry')
      const location = response.headers.get('location')
      observations.push({ path: scenario.path, locale: scenario.locale, status: response.status, location, entries: entries.length })
      assert.equal(response.status, 307, JSON.stringify(observations))
      assert.ok(location?.startsWith(scenario.expected), JSON.stringify(observations))
      assert.equal(entries.length, 1, 'The forged cookie must not produce internal proxy reentry: ' + JSON.stringify(entries))
    }
    process.stdout.write('KAN-849 HTTP_FORGED_TEAM_ANONYMOUS ' + JSON.stringify(observations) + '\n')
  } finally {
    await stopNextHttpServer(child)
    fixture.cleanup()
    assert.equal(operatorTypesSnapshot(), typesBefore)
    assert.equal(operatorConfigSnapshot(), configBefore)
  }
})
