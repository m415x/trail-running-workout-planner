import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

const require = createRequire(import.meta.url)

async function availablePort(): Promise<number> {
  const server = createServer()
  return await new Promise<number>((resolvePort, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('No port'))
      server.close(() => resolvePort(address.port))
    })
  })
}

test('KAN-854/T1 captures genuine disposable Next HTTP redirects without repository writes', { timeout: 120_000 }, async () => {
  // Place the disposable fixture inside the repository filesystem root so Next can\n  // resolve the existing pnpm installation without an out-of-root junction.\n  const temporaryRoot = resolve('.tmp')\n  mkdirSync(temporaryRoot, { recursive: true })\n  const dir = mkdtempSync(join(temporaryRoot, 'kan-854-http-smoke-'))
  const port = await availablePort()
  const app = join(dir, 'app')
  mkdirSync(join(app, 'api', 'kan-854-redirect'), { recursive: true })
  const nextPackagePath = require.resolve('next/package.json')
  const nextVersion = (require(nextPackagePath) as { version: string }).version
  const nextCli = require.resolve('next/dist/bin/next')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ private: true, name: 'kan-854-disposable-next-http', version: '0.0.0' }))
  writeFileSync(join(app, 'layout.tsx'), "export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}\n")
  writeFileSync(join(app, 'page.tsx'), "export default function Page(){return <p>KAN-854 disposable fixture</p>}\n")
  writeFileSync(join(app, 'api', 'kan-854-redirect', 'route.ts'), [
    "export async function GET() {",
    "  return new Response(null, { status: 307, headers: { Location: '/es/login', 'X-KAN-854-Fixture': 'next-route' } })",
    "}",
  ].join('\n'))
  // Run webpack for predictable isolated fixture compilation; no package installation.\n  const child = spawn(process.execPath, [nextCli, 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: dir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let logs = ''
  let closed = false
  child.once('exit', () => { closed = true })
  child.stdout?.on('data', chunk => { logs += String(chunk); logs = logs.slice(-5000) })
  child.stderr?.on('data', chunk => { logs += String(chunk); logs = logs.slice(-5000) })
  try {
    let response: Response | undefined
    for (let attempt = 0; attempt < 55; attempt++) {
      if (closed) throw new Error('Next fixture exited: ' + logs)
      try {
        const probe = await fetch('http://127.0.0.1:' + port + '/api/kan-854-redirect', {
          redirect: 'manual',
          signal: AbortSignal.timeout(3000),
        })
        if (probe.headers.get('x-kan-854-fixture') === 'next-route') {
          response = probe
          break
        }
      } catch { /* Next compilation can take time; bounded attempts */ }
      await delay(1000)
    }
    assert.ok(response, 'Real Next route did not become ready: ' + logs)
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), '/es/login')
    assert.match(nextVersion, /^16\.3\.8$/, 'T1 smoke must not silently run candidate C or patched branch')
  } finally {
    if (!closed) {
      if (process.platform === 'win32') {
        // Node on Windows may leave child descendants; terminate the spawned process tree.
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
        await new Promise<void>(done => killer.once('exit', () => done()))
      } else {
        child.kill('SIGTERM')
      }
    }
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
})
