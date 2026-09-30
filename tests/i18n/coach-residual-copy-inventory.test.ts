import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

interface InventoryEntry {
  path: string
  area: string
  status: 'clean' | 'fix' | 'deferred'
  markers?: string[]
}

interface Inventory {
  story: string
  task: string
  entries: InventoryEntry[]
}

describe('KAN-506 Coach residual copy inventory', () => {
  it('is reproducible against the current bounded Coach surfaces', async () => {
    const inventory = JSON.parse(
      await readFile('tests/fixtures/i18n/kan-506-coach-residual-copy-inventory.json', 'utf8'),
    ) as Inventory

    assert.equal(inventory.story, 'KAN-506')
    assert.equal(inventory.task, 'KAN-552')
    assert.ok(inventory.entries.some(entry => entry.area === 'planning' && entry.status === 'fix'))
    assert.ok(inventory.entries.some(entry => entry.area === 'sessions' && entry.status === 'fix'))
    assert.ok(inventory.entries.some(entry => entry.area === 'membership' && entry.status === 'fix'))

    for (const entry of inventory.entries) {
      const source = await readFile(entry.path, 'utf8')

      if (entry.status === 'clean') {
        assert.match(
          source,
          /useTranslations|getTranslations/,
          `${entry.path} should retain an i18n boundary`,
        )
        continue
      }

      for (const marker of entry.markers ?? []) {
        assert.ok(
          source.includes(marker),
          `${entry.path} should still expose inventoried marker: ${marker}`,
        )
      }
    }
  })
})
