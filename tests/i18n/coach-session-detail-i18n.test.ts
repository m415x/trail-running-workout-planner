import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 Coach session detail i18n closure', () => {
  it('moves generation-review copy behind the existing Sessions catalog and localized routing', async () => {
    const source = await readFile(
      'app/[locale]/dashboard/sessions/[sessionId]/page.tsx',
      'utf8',
    )

    assert.match(source, /getTranslations\(['"]Sessions['"]\)/)
    assert.match(source, /from ['"]@\/i18n\/routing['"]/)
    assert.doesNotMatch(source, /from ['"]next\/link['"]/)
    assert.doesNotMatch(
      source,
      /Por qué se generó así|Evidencia histórica de generación por prescripción activa|Prescripción variante|Prescripción base|Ownership actual|Subgrupo|No hay una explicación histórica disponible/,
    )
  })
})
