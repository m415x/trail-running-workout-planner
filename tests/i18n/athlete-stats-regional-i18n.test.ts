import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 Athlete stats and realized-training regional closure', () => {
  it('removes direct presentation-locale inference from realized training history', async () => {
    const source = await readFile(
      'features/athletes/components/RealizedTrainingHistory.tsx',
      'utf8',
    )

    assert.match(source, /resolveApplicationRegionalContext/)
    assert.doesNotMatch(source, /locale === ['"]en['"] \? ['"]en-US['"] : ['"]es-AR['"]/)
  })

  it('moves the 1000 m athlete stats panel copy behind the stats catalog', async () => {
    const source = await readFile('app/[locale]/(mobile)/stats/page.tsx', 'utf8')

    assert.match(source, /getTranslations\(['"]stats['"]\)/)
    assert.doesNotMatch(source, /const es = locale === ['"]es['"]/)
    assert.doesNotMatch(
      source,
      /Más rápido|Más lento|Evidencia insuficiente|Registrá un test oficial programado|Referencia no disponible|Historial de tests|Registrar nuevo test/,
    )
  })
})
