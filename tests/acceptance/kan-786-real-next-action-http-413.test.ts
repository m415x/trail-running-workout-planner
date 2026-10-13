import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)

/**
 * KAN-786 RED: opt-in live HTTP contract at the ACTUAL Next Server Action route.
 * Requires an existing local canonical sqlite.db, but NEVER points the server
 * at that developer DB. Builds a SQLite online backup in a disposable directory.
 * The Action identifier is intentionally invalid: the request MUST be rejected
 * by the 1 MiB transport gate before action dispatch/auth/mutations.
 * This reproduces the HTTP boundary; it does not prove authenticated persistence.
 */
test('KAN-786 real Next Server Action transport rejects 53-week generation explanations before writes', { timeout: 180_000 }, async () => {
  const root = resolve('.')
  const developerDb = new Database(join(root, 'sqlite.db'), { readonly: true, fileMustExist: true })
  const temp = await mkdtemp(join(tmpdir(), 'kan-786-http-'))
  const database = join(temp, 'isolated.sqlite')
  const port = 41000 + (process.pid % 10000)
  let server: ReturnType<typeof spawn> | undefined
  try {
    await developerDb.backup(database)
    developerDb.close()
    const before = createHash('sha256').update(await readFile(database)).digest('hex')
    const childEnv = {
      ...process.env,
      CI: '1',
      SQLITE_SCENARIO_MODE: '1',
      SQLITE_DATABASE_PATH: database,
      PORT: String(port),
    }
    server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    let logs = ''
    server.stdout?.on('data', chunk => { logs = (logs + String(chunk)).slice(-4000) })
    server.stderr?.on('data', chunk => { logs = (logs + String(chunk)).slice(-4000) })
    const origin = `http://127.0.0.1:${port}`
    // Next startup readiness is signalled by the server itself. Do not GET a
    // protected dynamic planning route: its auth/compilation may hang even
    // after Next has finished bootstrapping, especially on Windows.
    let ready = false
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error(`Next exited before ready: ${logs}`)
      if (/Ready in \d+ms/.test(logs)) { ready = true; break }
      await new Promise(done => setTimeout(done, 250))
    }
    assert.ok(ready, `Next startup signal not observed: ${logs}`)

    // Preflight a small request through the same locale/proxy path, so a
    // route compilation or middleware stall cannot masquerade as HTTP 413.
    const target = origin + '/en/dashboard/planning/kan-786-probe'
    let preflight: Response
    try {
      preflight = await fetch(target, {
        method: 'POST', redirect: 'manual',
        headers: { 'Next-Action': 'kan-786-unknown-action' },
        body: new FormData(), signal: AbortSignal.timeout(45000),
      })
    } catch (error) {
      throw new Error(`Small Server Action preflight failed (not an HTTP 413 RED). serverLogs=\\n${logs}`, { cause: error })
    }
    assert.ok(![301, 302, 303, 307, 308].includes(preflight.status),
      `Small Server Action preflight redirected: HTTP ${preflight.status}, location=${preflight.headers.get('location')}, serverLogs=\\n${logs}`)
    console.log(`KAN-786 small Server Action preflight: HTTP ${preflight.status}`)

    const form = new FormData()
    form.set('planId', 'kan-786-probe')
    form.set('locale', 'es')
    form.set('proposal', JSON.stringify({ events: [], pad: 'p'.repeat(202900) }))
    form.set('generationExplanations', JSON.stringify({ pad: 'e'.repeat(1574450) }))
    let response: Response
    try {
      response = await fetch(target, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Next-Action': 'kan-786-unknown-action' },
      body: form,
      signal: AbortSignal.timeout(45000),
      })
    } catch (error) {
      throw new Error(`Oversized request timed out/failed after small preflight. serverLogs=\\n${logs}`, { cause: error })
    }
    assert.ok(![301, 302, 303, 307, 308].includes(response.status), `Request redirected before Server Action parsing: HTTP ${response.status}, location=${response.headers.get('location') ?? '(none)'}`)
    const after = createHash('sha256').update(await readFile(database)).digest('hex')
    assert.equal(after, before, '413 must not mutate isolated SQLite')
    assert.equal(response.status, 413, `expected Next transport rejection: ${response.status}`)

    // RED: the intended confirmation contract must no longer ship this body.
    // Subsequent T3b replaces this oversized baseline request with an actual
    // authorized compact submission and read-after-write equivalence checks.
    assert.ok(response.status !== 413, 'Large Coach confirmation is blocked by 1 MiB Server Action transport')
  } finally {
    if (server && server.exitCode === null) server.kill()
    await rm(temp, { recursive: true, force: true })
    try { developerDb.close() } catch { /* already closed */ }
  }
})
