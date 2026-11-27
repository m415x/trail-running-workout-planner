import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import * as probe from '@/scripts/acceptance-dev-windows-ctrlc-probe-state'

type State = {
  version: 1
  parentPid: number
  childPid: number
  port: number
  nonce: string
}
type Write = (input: { statePath: string; state: State }) => Promise<void>

const state: State = {
  version: 1,
  parentPid: 47431,
  childPid: 47432,
  port: 45321,
  nonce: 'd6f8188a8e81f031b5f87e12ad1b0c32',
}

test('KAN-885/T3 L6 records a strictly validated probe state exclusively in a new private file', async () => {
  const candidate = (probe as unknown as Record<string, unknown>)
    .writeAcceptanceDevCtrlcProbeState
  assert.equal(typeof candidate, 'function', 'exclusive Ctrl+C probe state writer must exist')
  const write = candidate as Write
  const dir = await mkdtemp(join(tmpdir(), 'kan-885-run-state-'))
  try {
    const statePath = join(dir, 'state.json')
    await write({ statePath, state })
    assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')), state)
    const metadata = await stat(statePath)
    assert.equal(metadata.isFile(), true)
    assert.ok(metadata.size > 0 && metadata.size <= 4096)
    if (process.platform !== 'win32') {
      assert.equal(metadata.mode & 0o077, 0, 'POSIX state record must exclude group/other permissions')
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('KAN-885/T3 L6 refuses overwrite and does not modify existing evidence', async () => {
  const write = (probe as unknown as Record<string, unknown>)
    .writeAcceptanceDevCtrlcProbeState as Write
  const dir = await mkdtemp(join(tmpdir(), 'kan-885-run-state-'))
  try {
    const statePath = join(dir, 'state.json')
    const original = 'never-overwrite-this-record'
    await writeFile(statePath, original, { flag: 'wx' })
    await assert.rejects(write({ statePath, state }), /KAN-885/i)
    assert.equal(await readFile(statePath, 'utf8'), original)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('KAN-885/T3 L6 rejects invalid records and relative paths before creating a state file', async () => {
  const write = (probe as unknown as Record<string, unknown>)
    .writeAcceptanceDevCtrlcProbeState as Write
  const dir = await mkdtemp(join(tmpdir(), 'kan-885-run-state-'))
  try {
    const target = join(dir, 'invalid.json')
    await assert.rejects(write({
      statePath: target,
      state: { ...state, childPid: state.parentPid },
    }), /KAN-885/i)
    await assert.rejects(write({ statePath: 'relative.json', state }), /KAN-885/i)
    await assert.rejects(readFile(target), { code: 'ENOENT' })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
