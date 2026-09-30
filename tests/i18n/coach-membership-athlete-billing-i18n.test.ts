import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 Athlete billing terms i18n closure', () => {
  it('moves billing actions and audit copy behind Membership i18n without changing currency authority', async () => {
    const source = await readFile(
      'features/memberships/components/AthleteBillingTermsForm.tsx',
      'utf8',
    )

    assert.match(source, /useTranslations\(['"]Membership/)
    assert.doesNotMatch(source, /const es = locale === ['"]es['"]/)
    assert.doesNotMatch(
      source,
      /Reducción o beca|Aplicar reducción|Retirar reducción|Prórroga individual|Aplicar prórroga|Retirar prórroga|Pagos|Registrar pago|Historial de pagos|Corregir pago|Anular pago/,
    )
    assert.match(source, /currency/)
  })
})
