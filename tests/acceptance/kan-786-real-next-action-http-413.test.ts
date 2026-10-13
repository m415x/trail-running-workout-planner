import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)
const fixtureDir = resolve('tests/fixtures/kan-786-next-app')

async function availablePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No TCP address')
  const port = address.port
  server.close()
  await once(server, 'close')
  return port
}

function annualProposal() {
  return {
    planId: 'kan-786-isolated-plan',
    scope: { type: 'sporting_group', teamId: 'team-fixture', sportingGroupId: 'group-fixture' },
    weeks: Array.from({ length: 53 }, (_, weekIndex) => ({
      weekNumber: weekIndex + 1,
      startDate: new Date(Date.UTC(2026, 0, 5 + weekIndex * 7)).toISOString().slice(0, 10),
      sessions: Array.from({ length: weekIndex < 27 ? 5 : 4 }, (_, sessionIndex) => ({
        id: `week-${weekIndex + 1}-session-${sessionIndex + 1}`,
        title: 'Base aeróbica — técnica, resistencia y adaptación de terreno',
        prescriptions: {
          type: 'trail-running',
          durationMinutes: 65,
          targetDistanceKm: 11,
          ascentMeters: 420,
          intensityZone: 'Z2',
        },
        coachNotes: 'Sesión de desarrollo aeróbico revisada por Coach, con ajuste de volumen y desnivel según la semana. '.repeat(6),
      })),
    })),
  }
}

function annualExplanations(sessionCount: number) {
  const stages = ['base', 'volume', 'terrain', 'intensity', 'recovery', 'specificity', 'cohort', 'validation', 'final']
  return Array.from({ length: sessionCount }, (_, sessionIndex) => ({
    generationKey: `kan786-session-${sessionIndex + 1}`,
    planningScope: 'SPORTING_GROUP_BASE',
    stages: stages.map((stage, stageIndex) => ({
      stage,
      sequence: stageIndex,
      inputs: { source: 'coach-reviewed-preview', week: Math.floor(sessionIndex / 5) + 1 },
      explanation: `Etapa ${stage}: justificación histórica sobre volumen, recuperación, terreno, intensidad y prescripción individual de la sesión ${sessionIndex + 1}. `.repeat(5),
    })),
  }))
}

test('KAN-786 native Next Server Action rejects representative annual body before any durable write', { timeout: 180_000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'kan-786-next-'))
  const databasePath = join(temporary, 'scenario.sqlite')
  const database = new Database(databasePath)
  database.exec('CREATE TABLE receipts (id INTEGER PRIMARY KEY, proposal_bytes INTEGER NOT NULL, explanation_bytes INTEGER NOT NULL)')
  database.close()
  const port = await availablePort()
  const origin = `http://127.0.0.1:${port}`
  const next = require.resolve('next/dist/bin/next')
  let server: ChildProcess | undefined
  let logs = ''
  try {
    server = spawn(process.execPath, [next, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
      // Next 16 resolves proxy.ts and the app root from its working directory.
      // Running from the repository root accidentally compiles production proxy.ts.
      cwd: fixtureDir,
      env: { ...process.env, CI: '1', KAN786_SQLITE_PATH: databasePath },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout?.on('data', chunk => { logs = (logs + String(chunk)).slice(-16000) })
    server.stderr?.on('data', chunk => { logs = (logs + String(chunk)).slice(-16000) })

    let page: Response | undefined
    for (let attempt = 0; attempt < 80; attempt++) {
      if (server.exitCode !== null) throw new Error(`Next exited early: ${logs}`)
      try {
        page = await fetch(origin, { signal: AbortSignal.timeout(5000) })
        if (page.ok) break
      } catch { /* server booting */ }
      await new Promise(done => setTimeout(done, 300))
    }
    assert.equal(page?.status, 200, `Fixture route did not render: ${logs}`)
    const markup = await page.text()
    assert.match(markup, /KAN-786 Server Action transport fixture/)
    // React renders its own real registered action reference into the HTML form.
    // Submit the server-rendered form's hidden action field: never fabricate Next-Action.
    const actionName = markup.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1]
    assert.ok(actionName, 'The genuine Server Action reference was not rendered')
    const submit = (proposal: string, generationExplanations: string) => {
      const form = new FormData()
      form.set(actionName, '')
      form.set('proposal', proposal)
      form.set('generationExplanations', generationExplanations)
      return fetch(origin, { method: 'POST', body: form, redirect: 'follow', signal: AbortSignal.timeout(45000) })
    }

    // Positive control: same route, registered action, serialization, and SQLite writer.
    const small = await submit(JSON.stringify({ sessions: [] }), '[]')
    assert.ok(small.ok, `Native small submission failed HTTP ${small.status}: ${logs}`)
    const count = () => {
      const db = new Database(databasePath, { readonly: true, fileMustExist: true })
      try { return (db.prepare('SELECT COUNT(*) AS count FROM receipts').get() as { count: number }).count }
      finally { db.close() }
    }
    assert.equal(count(), 1, 'Positive control did not execute registered action')

    const proposal = JSON.stringify(annualProposal())
    const generationExplanations = JSON.stringify(annualExplanations(239))
    const proposalBytes = Buffer.byteLength(proposal)
    const explanationBytes = Buffer.byteLength(generationExplanations)
    assert.ok(proposalBytes > 150_000 && proposalBytes < 300_000, `Unrepresentative proposal bytes: ${proposalBytes}`)
    assert.ok(explanationBytes > 1_300_000 && explanationBytes < 1_900_000, `Unrepresentative explanation bytes: ${explanationBytes}`)
    const before = createHash('sha256').update(await readFile(databasePath)).digest('hex')
    const oversized = await submit(proposal, generationExplanations)
    await oversized.text()
    await new Promise(done => setTimeout(done, 300))
    const after = createHash('sha256').update(await readFile(databasePath)).digest('hex')

    assert.equal(after, before, 'Oversized submission mutated disposable SQLite')
    assert.equal(count(), 1, 'Oversized submission reached the Server Action writer')
    assert.match(logs, /Body exceeded 1 MB limit/i, `Missing Next body-limit diagnostic; status=${oversized.status}; logs=${logs}`)
    assert.ok(oversized.status === 413 || oversized.status === 500,
      `Unexpected outward status ${oversized.status}; logs=${logs}`)
    assert.doesNotMatch(logs, /Server Reference ID did not match|unknown-action/i, 'Action reference was invalid')
    console.log(`KAN-786 CAUSAL 413: HTTP ${oversized.status}, proposal=${proposalBytes} bytes, explanations=${explanationBytes} bytes; SQLite unchanged; valid small action reached writer`)
  } finally {
    if (server && server.exitCode === null && !server.killed) {
      const exited = once(server, 'exit').catch(() => undefined)
      server.kill()
      await Promise.race([exited, new Promise(done => setTimeout(done, 3000))])
    }
    await rm(temporary, { recursive: true, force: true })
  }
})
