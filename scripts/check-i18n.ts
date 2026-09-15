import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

type JsonObject = Record<string, unknown>

const ROOT = path.resolve(process.cwd(), 'messages')

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function walkJsonFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walkJsonFiles(full) : entry.isFile() && entry.name.endsWith('.json') ? [full] : []
    })
    .sort()
}

function merge(target: JsonObject, source: JsonObject, sourceName: string, prefix = ''): void {
  for (const [key, value] of Object.entries(source)) {
    const keyPath = prefix ? `${prefix}.${key}` : key
    const existing = target[key]

    if (existing === undefined) {
      target[key] = value
    } else if (isObject(existing) && isObject(value)) {
      merge(existing, value, sourceName, keyPath)
    } else {
      throw new Error(`Duplicate message key "${keyPath}" in ${sourceName}`)
    }
  }
}

function load(locale: string): JsonObject {
  const root = path.join(ROOT, locale)
  const catalog: JsonObject = {}

  for (const file of walkJsonFiles(root)) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as JsonObject
    merge(catalog, parsed, path.relative(ROOT, file))
  }

  return catalog
}

function collectShape(value: unknown, prefix = ''): string[] {
  if (!isObject(value)) return [`${prefix}:leaf`]

  const keys = Object.keys(value).sort()
  if (keys.length === 0) return [`${prefix}:object`]

  return keys.flatMap((key) => {
    const child = prefix ? `${prefix}.${key}` : key
    return collectShape(value[key], child)
  })
}

const en = load('en')
const es = load('es')

assert.deepEqual(
  collectShape(en),
  collectShape(es),
  'English and Spanish message catalogs must have the same key/shape structure',
)

console.log(`i18n check passed: ${collectShape(en).length} message leaves are aligned`)
