/**
 * KAN-790/T5.3 — compares two already server-sourced generation manifests.
 * This is not a manifest builder, an authorization check or a reconciliation
 * read-set validator. The calling boundary must supply fresh SQL facts.
 */
export type ReviewSnapshotSourceFreshnessResult =
  | { readonly kind: 'current' }
  | { readonly kind: 'generation_stale' }

function canonicalJson(value: unknown): string | null {
  const ancestors = new Set<object>()

  function encode(item: unknown): string {
    if (item === null) return 'null'
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item)
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item)
    if (typeof item !== 'object') throw new Error('Invalid source manifest value')
    if (ancestors.has(item)) throw new Error('Cyclic source manifest')

    const prototype = Object.getPrototypeOf(item)
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) {
      throw new Error('Source manifest requires plain JSON objects')
    }

    ancestors.add(item)
    try {
      if (Array.isArray(item)) {
        // Arrays describe ordered facts: never normalize their ordering.
        return '[' + item.map(entry => encode(entry)).join(',') + ']'
      }
      const record = item as Record<string, unknown>
      const keys = Object.keys(record).sort()
      return '{' + keys.map(key =>
        JSON.stringify(key) + ':' + encode(record[key]),
      ).join(',') + '}'
    } finally {
      ancestors.delete(item)
    }
  }

  if (value === null || Array.isArray(value) || typeof value !== 'object' ||
    Object.keys(value).length === 0) {
    return null
  }

  try {
    return encode(value)
  } catch {
    return null
  }
}

/**
 * A changed or invalid source manifest invalidates generation evidence;
 * reconciliation_conflict belongs exclusively to the separate persistence
 * read-set check and must not be inferred from generation inputs.
 */
export function evaluateReviewSnapshotSourceFreshness(
  generatedManifest: unknown,
  currentManifest: unknown,
): ReviewSnapshotSourceFreshnessResult {
  const generated = canonicalJson(generatedManifest)
  const current = canonicalJson(currentManifest)
  if (generated === null || current === null || generated !== current) {
    return { kind: 'generation_stale' }
  }
  return { kind: 'current' }
}
