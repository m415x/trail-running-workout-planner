import assert from 'node:assert/strict'
import { spawnSync, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

function digestTree(path: string): string {
  const hash = createHash('sha256')
  const walk = (p: string, relative: string): void => {
    if (!existsSync(p)) { hash.update('missing:' + relative); return }
    if (statSync(p).isDirectory()) {
      for (const name of readdirSync(p).sort()) walk(join(p, name), relative + '/' + name)
    } else {
      hash.update(relative)
      hash.update(readFileSync(p))
    }
  }
  walk(path, '.')
  return hash.digest('hex')
}

export function operatorTypesSnapshot(): string {
  return digestTree(resolve('.next/dev/types'))
}

export function createHttpDistDir(): { distDir: string; cleanup: () => void } {
  const root = resolve('.tmp')
  mkdirSync(root, { recursive: true })
  const absolute = mkdtempSync(join(root, 'kan-848-next-http-'))
  return {
    distDir: '.tmp/' + absolute.split(/[\\/]/).at(-1),
    cleanup: () => rmSync(absolute, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }),
  }
}

export async function stopNextHttpServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32' && child.pid) {
    // Terminate the whole spawned Next process tree, not only its CLI parent.
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
  } else {
    child.kill()
  }
  const closed = await Promise.race([
    new Promise<boolean>(resolve => child.once('close', () => resolve(true))),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2500)),
  ])
  if (closed) return
  if (process.platform === 'win32' && child.pid) {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
    assert.equal(result.status, 0, 'Could not terminate isolated Next.js process tree')
  } else {
    child.kill('SIGKILL')
  }
  const finished = await Promise.race([
    new Promise<boolean>(resolve => child.once('close', () => resolve(true))),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), 4000)),
  ])
  assert.ok(finished, 'Isolated Next.js process did not close; preserve distDir for diagnosis')
}
