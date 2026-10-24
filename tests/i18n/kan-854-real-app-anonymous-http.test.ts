import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { captureHttpRedirectChain } from '../../scripts/experiments/kan-854-http-capture'

const require = createRequire(import.meta.url)

test('KAN-854/T1 observes authentic anonymous application routing', { timeout: 180_000 }, async () => {
  const root = resolve('.')
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer', windowsHide: true })
  assert.equal(tracked.status, 0)
  const prefixes = ['app/', 'components/', 'hooks/', 'i18n/', 'lib/', 'db/', 'public/', 'messages/', 'types/', 'utils/']
  const roots = new Set(['next.config.ts', 'proxy.ts', 'package.json', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs', 'components.json', 'tailwind.config.ts'])
  const files = (tracked.stdout as Buffer).toString('utf8').split('\0')
    .filter(path => prefixes.some(p => path.startsWith(p)) || roots.has(path))
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
    const port = await new Promise<number>((done, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') return reject(new Error('No TCP port'))
        server.close(() => done(address.port))
      })
    })
    child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: dir,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: join(dir, 'sqlite.db') },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child.stdout?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.stderr?.on('data', chunk => { logs = (logs + String(chunk)).slice(-9000) })
    child.once('close', () => { stopped = true })
    const origin = 'http://127.0.0.1:' + port
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
    for (const route of ['/', '/es', '/en', '/dashboard/athletes', '/es/dashboard/athletes', '/en/dashboard/athletes']) {
      const result = await captureHttpRedirectChain(origin + route, { permittedOrigins: [origin], maxHops: 5, timeoutMs: 20_000 })
      process.stdout.write('KAN-854 HTTP ' + JSON.stringify({ version, route, result }) + '\n')
      assert.ok(result.hops.length > 0)
      assert.notEqual(result.termination, 'loop', 'CONTRACT_RED_OBSERVED_CAUSALITY_PENDING: redirect loop on ' + route + '; hops=' + JSON.stringify(result.hops) + '; nextLogs=' + logs)
      assert.ok(result.hops.every(h => h.status < 500), 'CONTRACT_RED: HTTP 5xx on ' + route + ': ' + logs)
    }
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
