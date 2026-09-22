import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function discoverTestFiles(root: string): Promise<string[]> {
  const files: string[] = []

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      const path = resolve(directory, entry.name)

      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        files.push(path)
      }
    }
  }

  await walk(root)
  files.sort()

  if (files.length === 0) {
    throw new Error(`No .test.ts files found under ${root}`)
  }

  return files
}

export function runTestFiles(testFiles: string[]): number {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
    shell: false,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.signal) {
    process.kill(process.pid, result.signal)
    return 1
  }

  return result.status ?? 1
}

async function main(): Promise<void> {
  const testFiles = await discoverTestFiles(resolve(process.cwd(), 'tests'))
  console.log(`Discovered ${testFiles.length} test files`)
  process.exitCode = runTestFiles(testFiles)
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
