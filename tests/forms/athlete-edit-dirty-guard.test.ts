import assert from 'node:assert/strict'
import test from 'node:test'
import { athleteFormDirtyValuesFromFormData } from '../../features/athletes/lib/athlete-form-dirty-values'

test('reads the current editable athlete values from submitted form data', () => {
  const formData = new FormData()
  formData.set('locale', 'es')
  formData.set('athleteId', 'athlete-1')
  formData.set('firstName', 'Ana')
  formData.set('lastName', 'Pérez')
  formData.set('email', 'ana@example.com')
  formData.set('dni', '123')
  formData.set('nickName', 'Ani')
  formData.set('birthday', '1990-01-01')
  formData.set('phone', '555')
  formData.set('emergencyContact', 'Luis')
  formData.set('emergencyPhone', '777')

  assert.deepEqual(athleteFormDirtyValuesFromFormData(formData), {
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    dni: '123',
    nickName: 'Ani',
    birthday: '1990-01-01',
    phone: '555',
    emergencyContact: 'Luis',
    emergencyPhone: '777',
  })
})

test('missing optional fields normalize to empty strings', () => {
  const formData = new FormData()
  formData.set('firstName', 'Ana')
  formData.set('lastName', 'Pérez')
  formData.set('email', 'ana@example.com')
  formData.set('dni', '123')

  assert.deepEqual(athleteFormDirtyValuesFromFormData(formData), {
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    dni: '123',
    nickName: '',
    birthday: '',
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
  })
})
