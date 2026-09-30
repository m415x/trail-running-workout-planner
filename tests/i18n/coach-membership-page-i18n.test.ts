import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const SURFACES = [
  'app/[locale]/dashboard/membership/page.tsx',
  'features/memberships/components/GlobalDueDateExceptionForm.tsx',
  'features/memberships/components/TeamMonthlyMaterializationForm.tsx',
] as const

describe('KAN-506 Coach membership page i18n closure', () => {
  it('moves page, exception and materialization copy behind next-intl', async () => {
    for (const path of SURFACES) {
      const source = await readFile(path, 'utf8')

      assert.match(source, /useTranslations|getTranslations/)
      assert.doesNotMatch(
        source,
        /Política vigente|Historial de políticas|Historial de excepciones|Excepción mensual de vencimiento|Aplicar excepción|Atletas procesados:|Materializar cuotas/,
      )
      assert.doesNotMatch(source, /const es = .*=== ['"]es['"]/)
    }
  })
})
