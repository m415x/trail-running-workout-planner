/** Subprocess helper; not a standalone test or an HTTP acceptance probe. */
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'

async function main() {
  const target = realpathSync(process.env.SQLITE_DATABASE_PATH ?? '')
  const canonical = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
  assert.equal(canonical(dirname(dirname(target))), canonical(realpathSync(tmpdir())))
  assert.ok(basename(dirname(target)).startsWith('kan-873-action-'))
  assert.equal(basename(target), 'sqlite.db')
  assert.notEqual(canonical(target), canonical(resolve('sqlite.db')))
  assert.equal(process.env.SQLITE_SCENARIO_MODE, '1')
  assert.equal(process.env.EPT_IDENTITY_BACKEND, 'sqlite')
  assert.equal(process.env.RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS, undefined)

  const { saveRaceCatalog } = await import('../../app/actions/race-catalog-actions')
  const form = new FormData()
  form.set('kind', 'event')
  form.set('operation', 'save')
  form.set('locale', 'es')
  form.set('name', 'KAN-873 RED anonymous probe')
  form.set('description', '')
  form.set('websiteUrl', '')
  form.set('status', 'active')

  let returned = false
  let error: unknown = null
  try {
    const result = await saveRaceCatalog({}, form)
    returned = true
    error = result.error ?? null
  } catch {
    // The parent still inspects durable SQLite state, even after a throw.
  }
  console.log('KAN873_RESULT:' + JSON.stringify({ invoked: true, returned, error }))
}

main().catch(() => {
  console.error('KAN-873 subprocess setup failed')
  process.exitCode = 2
})
