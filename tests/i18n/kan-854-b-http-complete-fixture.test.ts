import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer, connect } from 'node:net'
import { lookup } from 'node:dns/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { captureHttpRedirectChain } from '../../scripts/experiments/kan-854-http-capture'

const require = createRequire(import.meta.url)

for (const bindHost of ['127.0.0.1', 'localhost'] as const) test('KAN-854/B patched runtime authentic HTTP '+bindHost, { timeout: 240_000 }, async () => {
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
    // Load developer-local public Auth configuration without copying .env files to the fixture.
    const { loadEnvConfig } = require('@next/env') as { loadEnvConfig: (dir: string, dev?: boolean) => unknown }
    loadEnvConfig(root, true)
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    assert.ok(authUrl && authKey, 'EXPERIMENT_SETUP_ERROR: real-app HTTP requires local Supabase public URL/key; no synthetic fallback')
    const version = (require('next/package.json') as {version:string}).version
    assert.equal(version, '16.3.8')
    const historicalSha = '5df5693f0ab5717b22bebcbea16110a7722d470a'
    const patchHash = '6405c9217c3f38afb8070d800f6c36459927ddc3ed7c8bfd62ba32d951af1912'
    const historicalRouterHash = '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3'
    const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    const runtimeRoot = join(dir, 'node_modules', 'next')
    cpSync(dirname(require.resolve('next/package.json')), runtimeRoot, { recursive: true })
    const routerPath = join(runtimeRoot, 'dist/server/lib/router-utils/resolve-routes.js')
    const sourceRouter = readFileSync(require.resolve('next/dist/server/lib/router-utils/resolve-routes.js'))
    assert.equal(digest(readFileSync(routerPath)), digest(sourceRouter))
    const historical = spawnSync('git', ['show', historicalSha + ':patches/next@16.3.8.patch'], { cwd: root, encoding: 'buffer', windowsHide: true })
    assert.equal(historical.status, 0, 'EXPERIMENT_SETUP_ERROR: cannot retrieve historical patch')
    const patch = historical.stdout as Buffer
    assert.equal(digest(patch), patchHash, 'EXPERIMENT_INCONCLUSIVE: B patch identity differs')
    const patchFile = join(dir, 'historical.patch')
    writeFileSync(patchFile, patch)
    const check = spawnSync('git', ['apply', '--check', patchFile], { cwd: runtimeRoot, encoding: 'utf8', windowsHide: true })
    assert.equal(check.status, 0, 'EXPERIMENT_INCONCLUSIVE: isolated Next router patch cannot apply: '+check.stderr)
    const applied = spawnSync('git', ['apply', patchFile], { cwd: runtimeRoot, encoding: 'utf8', windowsHide: true })
    assert.equal(applied.status, 0, 'EXPERIMENT_SETUP_ERROR: applying B patch failed: '+applied.stderr)
    const routerRaw = readFileSync(routerPath)
    const routerNormalizedHash = digest(Buffer.from(routerRaw.toString('utf8').replace(/\r\n/g, '\n')))
    assert.equal(routerNormalizedHash, historicalRouterHash, 'EXPERIMENT_INCONCLUSIVE: isolated B router identity mismatch')
    const nextBin = join(runtimeRoot, 'dist/bin/next')
    assert.ok(existsSync(nextBin))
    assert.equal(digest(readFileSync(require.resolve('next/dist/server/lib/router-utils/resolve-routes.js'))), digest(sourceRouter), 'A router modified')
    process.stdout.write('KAN-854 B_RUNTIME_PRESTART '+JSON.stringify({bindHost, historicalSha, patchHash, nextBin, routerPath, routerNormalizedHash, mechanism:'git apply on isolated Next package'})+'\n')
    // db/index.ts compares scenario DB against process.cwd()/sqlite.db.
    // A disposable fixture still must use a differently named DB, and it must exist.
    const scenarioDbPath = join(dir, 'kan-854-scenario.sqlite')
    assert.notEqual(resolve(scenarioDbPath), resolve(dir, 'sqlite.db'), 'scenario DB cannot alias default development file')
    // KAN-615 intentionally blocks generic Drizzle migration at 0016.
    // Use the canonical dedicated upgrade executor on an isolated target.
    const tsxCli = require.resolve('tsx/cli')
    const upgrade = spawnSync(process.execPath, [tsxCli, resolve(root, 'scripts/upgrade-sqlite.ts')], {
      cwd: root,
      env: {
        ...process.env,
        SQLITE_SCENARIO_MODE: '1',
        SQLITE_DATABASE_PATH: scenarioDbPath,
        TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
      },
      windowsHide: true,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    assert.equal(upgrade.error, undefined, 'EXPERIMENT_SETUP_ERROR: SQLite upgrade could not start')
    assert.equal(upgrade.status, 0,
      'EXPERIMENT_SETUP_ERROR: dedicated SQLite upgrade failed: ' + upgrade.stdout + upgrade.stderr)
    assert.ok(existsSync(scenarioDbPath), 'EXPERIMENT_SETUP_ERROR: migrated SQLite not created')
    const port = await new Promise<number>((done, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(0, bindHost, () => {
        const address = server.address()
        if (!address || typeof address === 'string') return reject(new Error('No TCP port'))
        server.close(() => done(address.port))
      })
    })
    child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '-H', bindHost, '-p', String(port)], {
      cwd: dir,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: scenarioDbPath },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child.stdout?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.stderr?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.once('close', () => { stopped = true })
    const origin = 'http://' + bindHost + ':' + port
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
    process.stdout.write('KAN-854 B_NETWORK ' + JSON.stringify(networkDiagnostic) + '\n')
    assert.ok(readFileSync(join(dir, 'context/MobileShellContext.tsx'), 'utf8').length > 0, 'EXPERIMENT_SETUP_ERROR: missing context source')
    const findings: Array<{requestedHost:string;route:string;termination:string;status:number;location:string|null;error?:string}> = []
    for (const requestedHost of [bindHost]) {
      for (const route of ['/', '/es']) {
        try {
          // Bind and request 127.0.0.1 with the same complete Auth/SQLite fixture as localhost.
          const result = await captureHttpRedirectChain(origin + route, {
            permittedOrigins: [origin],
            headers: { Host: requestedHost + ':' + port },
            maxHops: 4,
            timeoutMs: 60_000,
          })
          findings.push({ requestedHost, route, termination: result.termination, status: result.hops[0]?.status ?? 0, location: result.hops[0]?.location ?? null })
          process.stdout.write('KAN-854 B_HTTP_MATRIX ' + JSON.stringify({ requestedHost, route, result }) + '\n')
        } catch (error) {
          const detail = error instanceof Error ? error.name + ': ' + error.message : String(error)
          findings.push({ requestedHost, route, termination: 'experimental_error', status: 0, location: null, error: detail })
          process.stdout.write('KAN-854 B_HTTP_ERROR ' + JSON.stringify({ requestedHost, route, detail }) + '\n')
        }
      }
    }
    process.stdout.write('KAN-854 B_HTTP_CHARACTERIZATION ' + JSON.stringify({ findings, networkDiagnostic, nextLogs: logs }) + '\n')
    assert.equal(findings.length, 2)
    assert.ok(findings.every(f => f.termination !== 'experimental_error'), 'EXPERIMENT_INCONCLUSIVE: cannot characterize IPv4 bind')
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
