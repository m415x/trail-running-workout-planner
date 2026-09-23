import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseSessionPrescriptions } from '@/lib/sessions/session-prescription-parser'

describe('prescripciones grupales de una sesión', () => {
  it('exige al menos un grupo', () => {
    assert.deepEqual(parseSessionPrescriptions(new FormData()), {
      success: false,
      errorCode: 'groupRequired',
    })
  })

  it('convierte y conserva una prescripción por zona de FC', () => {
    const form = prescriptionForm('group_s2', 'micro_1')
    form.set('distanceKm:group_s2', '12.5')
    form.set('durationMin:group_s2', '75')
    form.set('elevationGain:group_s2', '430')
    form.set('intensityMethod:group_s2', 'hr_zone')
    form.set('zone:group_s2', 'Z3')
    form.set('prescriptionNotes:group_s2', ' Ritmo controlado ')

    const result = parseSessionPrescriptions(form)
    assert.equal(result.success, true)
    if (!result.success) return
    assert.deepEqual(result.data[0], {
      groupId: 'group_s2',
      microcycleId: 'micro_1',
      distanceKm: 12.5,
      durationMin: 75,
      elevationGain: 430,
      intensityMethod: 'hr_zone',
      zone: 'Z3',
      referencePercentage: null,
      notes: 'Ritmo controlado',
    })
  })

  it('rechaza FC sin zona y porcentaje de referencia fuera de rango', () => {
    const heartRateForm = prescriptionForm('group_s2', 'micro_1')
    heartRateForm.set('intensityMethod:group_s2', 'hr_zone')
    assert.equal(getErrorCode(heartRateForm), 'hrZoneRequired')

    const pamForm = prescriptionForm('group_s2', 'micro_1')
    pamForm.set('intensityMethod:group_s2', 'reference_percentage')
    pamForm.set('referencePercentage:group_s2', '250')
    assert.equal(getErrorCode(pamForm), 'referencePercentageInvalid')
  })

  it('conserva 90 como porcentaje humano y rechaza el método legacy', () => {
    const form = prescriptionForm('group_s2', 'micro_1')
    form.set('intensityMethod:group_s2', 'reference_percentage')
    form.set('referencePercentage:group_s2', '90')
    const result = parseSessionPrescriptions(form)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data[0].referencePercentage, 90)
      assert.equal(result.data[0].intensityMethod, 'reference_percentage')
    }

    form.set('intensityMethod:group_s2', 'pam_percentage')
    assert.equal(getErrorCode(form), 'prescriptionsInvalid')
  })

  it('admite varios grupos y elimina selecciones duplicadas', () => {
    const form = prescriptionForm('group_s2', 'micro_s2')
    form.append('prescriptionGroupId', 'group_s2')
    form.append('prescriptionGroupId', 'group_m1')
    form.set('microcycleId:group_m1', 'micro_m1')

    const result = parseSessionPrescriptions(form)
    assert.equal(result.success, true)
    if (result.success) assert.deepEqual(result.data.map((item) => item.groupId), ['group_s2', 'group_m1'])
  })
})

function prescriptionForm(groupId: string, microcycleId: string) {
  const form = new FormData()
  form.append('prescriptionGroupId', groupId)
  form.set(`microcycleId:${groupId}`, microcycleId)
  return form
}

function getErrorCode(form: FormData) {
  const result = parseSessionPrescriptions(form)
  assert.equal(result.success, false)
  return result.success ? '' : result.errorCode
}
