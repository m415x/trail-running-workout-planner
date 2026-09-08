import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canRegenerationReplace,
  generatedEventProvenance,
  generatedPrescriptionProvenance,
  manualEventProvenance,
  manualPrescriptionProvenance,
  markAsManuallyModified,
} from '@/lib/session-generation/generation-ownership'

describe('procedencia y protección de sesiones generadas', () => {
  it('permite reemplazar solamente registros generados sin modificar', () => {
    assert.equal(canRegenerationReplace('generated'), true)
    assert.equal(canRegenerationReplace('generated_modified'), false)
    assert.equal(canRegenerationReplace('manual'), false)
  })

  it('protege un evento generado cuando el profesor lo modifica', () => {
    const original = generatedEventProvenance('plan-1::micro-1::shared-saturday')
    const modified = markAsManuallyModified(original)

    assert.deepEqual(modified, {
      ownership: 'generated_modified',
      sharedEventKey: original.sharedEventKey,
    })
    assert.equal(canRegenerationReplace(modified.ownership), false)
  })

  it('protege una prescripción independientemente del evento compartido', () => {
    const event = generatedEventProvenance('plan-1::micro-1::shared-saturday')
    const prescription = generatedPrescriptionProvenance('plan-1::micro-1::M1::weekly-saturday')
    const modifiedPrescription = markAsManuallyModified(prescription)

    assert.equal(canRegenerationReplace(event.ownership), true)
    assert.equal(canRegenerationReplace(modifiedPrescription.ownership), false)
    assert.equal(modifiedPrescription.generationKey, prescription.generationKey)
  })

  it('mantiene manuales y generados modificados sin degradar su procedencia', () => {
    const manualEvent = manualEventProvenance()
    const manualPrescription = manualPrescriptionProvenance()
    const modified = markAsManuallyModified({
      ownership: 'generated_modified' as const,
      generationKey: 'plan-1::micro-1::M1::weekly-tuesday',
    })

    assert.strictEqual(markAsManuallyModified(manualEvent), manualEvent)
    assert.strictEqual(markAsManuallyModified(manualPrescription), manualPrescription)
    assert.strictEqual(markAsManuallyModified(modified), modified)
  })

  it('rechaza claves vacías para registros generados', () => {
    assert.throws(() => generatedEventProvenance('  '), /sharedEventKey cannot be empty/)
    assert.throws(() => generatedPrescriptionProvenance(''), /generationKey cannot be empty/)
  })
})
