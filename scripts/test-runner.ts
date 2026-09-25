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

type TestRunResult = Pick<ReturnType<typeof spawnSync>, 'status' | 'signal' | 'error'>

export function interpretTestRunResult(result: TestRunResult): {
  exitCode: number | null
  signal: NodeJS.Signals | null
} {
  if (result.error) {
    throw result.error
  }

  if (result.signal) {
    return { exitCode: null, signal: result.signal }
  }

  return { exitCode: result.status ?? 1, signal: null }
}

export function planTestFileBatches(testFiles: string[], maxArgumentLength = 8_000): string[][] {
  const batches: string[][] = []
  let batch: string[] = []
  let argumentLength = 0

  for (const testFile of testFiles) {
    const nextLength = testFile.length + 1

    if (batch.length > 0 && argumentLength + nextLength > maxArgumentLength) {
      batches.push(batch)
      batch = []
      argumentLength = 0
    }

    batch.push(testFile)
    argumentLength += nextLength
  }

  if (batch.length > 0) {
    batches.push(batch)
  }

  return batches
}

export function runTestFiles(testFiles: string[]): number {
  for (const batch of planTestFileBatches(testFiles)) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...batch], {
      shell: false,
      stdio: 'inherit',
    })
    const outcome = interpretTestRunResult(result)

    if (outcome.signal) {
      process.kill(process.pid, outcome.signal)
      return 1
    }

    if (outcome.exitCode !== 0) {
      return outcome.exitCode ?? 1
    }
  }

  return 0
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
