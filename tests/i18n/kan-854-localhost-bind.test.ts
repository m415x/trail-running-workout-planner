import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, connect } from 'node:net'
import { lookup } from 'node:dns/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { captureHttpRedirectChain } from '../../scripts/experiments/kan-854-http-capture'

const require = createRequire(import.meta.url)

test('KAN-854/T1 compares loopback bind hostname on authentic anonymous application', { timeout: 240_000 }, async () => {
  const root = resolve('.')
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer', windowsHide: true })
  assert.equal(tracked.status, 0)
  // Copy the complete tracked application tree, not a hand-maintained directory allowlist.
  // Explicitly exclude non-runtime, executable, secret and local-state paths.
  const excluded = /^(?:tests\/|scripts\/|docs\/|\.github\/|drizzle\/|patches\/|\.tmp\/|\.next\/|node_modules\/|\.env(?:\.|$)|sqlite\.db$|.*\.(?:db|sqlite|zip|log)$)/
  const files = (tracked.stdout as Buffer).toString('utf8').split('\0')
    .filter(path => path && !excluded.test(path) && !path.startsWith('.git/'))
  assert.ok(files.includes('data/data.ts'), 'EXPERIMENT_SETUP_ERROR: tracked data/data.ts absent')
  assert.ok(files.includes('context/MobileShellContext.tsx'), 'EXPERIMENT_SETUP_ERROR: tracked context source absent')
  mkdirSync(resolve('.tmp'), { recursive: true })
  const dir = mkdtempSync(resolve('.tmp/kan-854-routing-'))
  let child: ReturnType<typeof spawn> | undefined
  let stopped = false
  let logs = ''
  let failure = false
  try {
    for (const file of files) {
      const dest = resolve(dir, file)
      const rel = relative(dir, dest)
      assert.ok(rel !== '..' && !rel.startsWith('..' + sep), 'Escaped fixture root')
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(resolve(root, file), dest)
    }
    assert.equal(readFileSync(join(dir, 'proxy.ts'), 'utf8'), readFileSync('proxy.ts', 'utf8'))
    assert.equal(readFileSync(join(dir, 'next.config.ts'), 'utf8'), readFileSync('next.config.ts', 'utf8'))
    const version = (require('next/package.json') as {version:string}).version
    assert.equal(version, '16.3.8')
    // db/index.ts compares scenario DB against process.cwd()/sqlite.db.\n    // A disposable fixture still must use a differently named DB, and it must exist.\n    const scenarioDbPath = join(dir, 'kan-854-scenario.sqlite')\n    assert.notEqual(resolve(scenarioDbPath), resolve(dir, 'sqlite.db'), 'scenario DB cannot alias default development file')\n    assert.ok(false, 'EXPERIMENT_SETUP_ERROR: provision a migrated disposable SQLite fixture before HTTP execution; no canonical sqlite.db fallback permitted')\n    const port = await new Promise<number>((done, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') return reject(new Error('No TCP port'))
        server.close(() => done(address.port))
      })
    })
    child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '-H', 'localhost', '-p', String(port)], {
      cwd: dir,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: scenarioDbPath },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child.stdout?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.stderr?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.once('close', () => { stopped = true })
    const origin = 'http://localhost:' + port
    const resolvedAddresses = await lookup('localhost', { all: true })
    const tcpProbe = async (host: string): Promise<string> => await new Promise<string>(done => {
      const socket = connect({ host, port, timeout: 1500 })
      socket.once('connect', () => { socket.destroy(); done('connected') })
      socket.once('timeout', () => { socket.destroy(); done('timeout') })
      socket.once('error', error => done((error as NodeJS.ErrnoException).code ?? error.message))
    })
    let ready = false
    for (let n = 0; n < 50; n++) {
      if (stopped) throw new Error('EXPERIMENT_SETUP_ERROR: Next exited: ' + logs)
      try {
        const response = await fetch(origin + '/_next/static/kan-854-probe', { redirect: 'manual', signal: AbortSignal.timeout(2500) })
        if (response.status === 404) { ready = true; break }
      } catch { /* Next startup is bounded */ }
      await delay(1000)
    }
    assert.ok(ready, 'EXPERIMENT_SETUP_ERROR: no HTTP readiness: ' + logs)
    const networkDiagnostic = { resolvedAddresses, ipv4: await tcpProbe('127.0.0.1'), ipv6: await tcpProbe('::1') }
    process.stdout.write('KAN-854 LOCALHOST_NETWORK ' + JSON.stringify(networkDiagnostic) + '\n')
    assert.ok(readFileSync(join(dir, 'context/MobileShellContext.tsx'), 'utf8').length > 0, 'EXPERIMENT_SETUP_ERROR: missing context source')
    const findings: Array<{requestedHost:string;route:string;termination:string;status:number;location:string|null;error?:string}> = []
    for (const requestedHost of ['localhost']) {
      for (const route of ['/', '/es']) {
        try {
          // Bind and request localhost; compare against prior 127.0.0.1-bound matrix.
          const result = await captureHttpRedirectChain(origin + route, {
            permittedOrigins: [origin],
            headers: { Host: requestedHost + ':' + port },
            maxHops: 4,
            timeoutMs: 60_000,
          })
          findings.push({ requestedHost, route, termination: result.termination, status: result.hops[0]?.status ?? 0, location: result.hops[0]?.location ?? null })
          process.stdout.write('KAN-854 BIND_MATRIX ' + JSON.stringify({ requestedHost, route, result }) + '\n')
        } catch (error) {
          const detail = error instanceof Error ? error.name + ': ' + error.message : String(error)
          findings.push({ requestedHost, route, termination: 'experimental_error', status: 0, location: null, error: detail })
          process.stdout.write('KAN-854 BIND_MATRIX_ERROR ' + JSON.stringify({ requestedHost, route, detail }) + '\n')
        }
      }
    }
    process.stdout.write('KAN-854 BIND_CHARACTERIZATION ' + JSON.stringify({ findings, networkDiagnostic, nextLogs: logs }) + '\n')
    assert.equal(findings.length, 2)
    assert.ok(findings.every(f => f.termination !== 'experimental_error'), 'EXPERIMENT_INCONCLUSIVE: cannot compare localhost bind')
    assert.ok(findings.every(f => f.status < 500), 'EXPERIMENT_SETUP_ERROR: HTTP 5xx invalidates routing comparison; inspect nextLogs for missing snapshot sources')
  } catch (error) {
    failure = true
    throw error
  } finally {
    if (child && !stopped && child.pid) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 })
      else child.kill('SIGTERM')
      if (!stopped) await Promise.race([new Promise<void>(done => child?.once('close', () => done())), delay(4000)])
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 6, retryDelay: 400 }) }
    catch (error) {
      process.stderr.write('KAN-854 CLEANUP_DEFERRED ' + JSON.stringify({ dir, priorFailure: failure, detail: String(error) }) + '\n')
    }
  }
})
