import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export type OperationalHandoffInput = {
  currentContent: string
  docsIndexContent: string
  availableHandoffs: string[]
}

export function validateOperationalHandoff(input: OperationalHandoffInput): string[] {
  const errors: string[] = []
  const storyMatch = input.currentContent.match(/\b(KAN-\d+)\b/i)

  if (!storyMatch) {
    return ['docs/handoffs/current.md must identify the current Jira story key.']
  }

  const storyKey = storyMatch[1].toUpperCase()
  const storySlug = storyKey.toLowerCase()
  const handoffName = `${storySlug}.md`
  const indexedCurrent = /handoffs\/current\.md/i.test(input.docsIndexContent)
  const indexedStory = new RegExp(`handoffs/${storySlug}\\.md`, 'i').test(input.docsIndexContent)
  const indexNamesStory = new RegExp(`\\b${storyKey}\\b`, 'i').test(input.docsIndexContent)

  if (!input.availableHandoffs.some((name) => name.toLowerCase() === handoffName)) {
    errors.push(`Missing story handoff docs/handoffs/${handoffName} for ${storyKey}.`)
  }

  if (!indexedCurrent) {
    errors.push('docs/README.md must index docs/handoffs/current.md.')
  }

  if (!indexedStory) {
    errors.push(`docs/README.md must index docs/handoffs/${handoffName}.`)
  }

  if (!indexNamesStory) {
    errors.push(`docs/README.md must identify ${storyKey} as the current integrated handoff baseline.`)
  }

  return errors
}

async function main(): Promise<void> {
  const currentPath = resolve('docs/handoffs/current.md')
  const indexPath = resolve('docs/README.md')
  const handoffsPath = resolve('docs/handoffs')

  const [currentContent, docsIndexContent, entries] = await Promise.all([
    readFile(currentPath, 'utf8'),
    readFile(indexPath, 'utf8'),
    readdir(handoffsPath, { withFileTypes: true }),
  ])

  const errors = validateOperationalHandoff({
    currentContent,
    docsIndexContent,
    availableHandoffs: entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  })

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`- ${error}\n`)
    process.exitCode = 1
    return
  }

  console.log('HANDOFF DOCS: PASS')
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
