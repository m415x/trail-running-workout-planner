import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const routes = [
  'app/[locale]/(mobile)/stats/page.tsx',
  'app/[locale]/(mobile)/stats/training/page.tsx',
  'app/[locale]/(mobile)/stats/load/page.tsx',
  'app/[locale]/(mobile)/stats/adherence/page.tsx',
  'app/[locale]/(mobile)/stats/competition/page.tsx',
] as const

const athleteCopy = /Estadísticas|Entrenamiento|Carga de corto plazo|Adherencia confirmada|Competencia principal|Datos insuficientes|Sin datos/

describe('athlete stats route i18n', () => {
  it('uses the Stats namespace in summary and every detail route', async () => {
    for (const route of routes) {
      const source = await readFile(route, 'utf8')
      assert.match(source, /getTranslations/)
      assert.match(source, /namespace:\s*['"]stats['"]|getTranslations\(['"]stats['"]\)/)
    }
  })

  it('does not retain athlete-facing Spanish copy inline', async () => {
    for (const route of routes) {
      const source = await readFile(route, 'utf8')
      assert.doesNotMatch(source, athleteCopy)
    }
  })
})
