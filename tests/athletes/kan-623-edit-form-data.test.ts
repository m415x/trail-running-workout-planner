import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareAthleteEditFormData } from '../../features/athletes/lib/athlete-edit-form-data'

test('KAN-623 prepares the same FormData with preserve when legacy names are unchanged', () => {
  const formData = new FormData()
  formData.set('firstName', 'Ana')
  formData.set('lastName', 'Acosta')

  const prepared = prepareAthleteEditFormData(
    { firstName: 'Ana', lastName: 'Acosta' },
    formData,
  )

  assert.equal(prepared, formData)
  assert.equal(formData.get('nameWriteIntent'), 'preserve')
})

test('KAN-623 prepares replace when the coach explicitly changes an administrative name', () => {
  const formData = new FormData()
  formData.set('firstName', 'Ana')
  formData.set('lastName', 'Acosta Prueba')

  prepareAthleteEditFormData({ firstName: 'Ana', lastName: 'Acosta' }, formData)
  assert.equal(formData.get('nameWriteIntent'), 'replace')
})

test('KAN-623 rejects missing or non-string names rather than inventing identity data', () => {
  const missing = new FormData()
  missing.set('firstName', 'Ana')
  assert.throws(
    () => prepareAthleteEditFormData({ firstName: 'Ana', lastName: 'Acosta' }, missing),
    /name/i,
  )
})
