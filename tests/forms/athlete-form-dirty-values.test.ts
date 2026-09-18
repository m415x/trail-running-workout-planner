import assert from 'node:assert/strict'
import test from 'node:test'
import { athleteFormDirtyValues } from '../../features/athletes/lib/athlete-form-dirty-values'

test('athlete edit baseline normalizes nullable optional values to form strings', () => {
  assert.deepEqual(
    athleteFormDirtyValues({
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      dni: '123',
      nickName: null,
      birthday: null,
      phone: undefined,
      emergencyContact: '',
      emergencyPhone: null,
    }),
    {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      dni: '123',
      nickName: '',
      birthday: '',
      phone: '',
      emergencyContact: '',
      emergencyPhone: '',
    },
  )
})

test('athlete dirty values only include editable fields', () => {
  const values = athleteFormDirtyValues({
    id: 'athlete-1',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    dni: '123',
  })

  assert.equal('id' in values, false)
  assert.equal(Object.keys(values).length, 9)
})
