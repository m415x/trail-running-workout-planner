import assert from 'node:assert/strict'
import test from 'node:test'
import {resolveIdentityBackend} from '@/lib/auth/identity-backend-selection'

test('KAN-791 identity backend selects SQLite by default and PostgreSQL explicitly',()=>{
  assert.equal(resolveIdentityBackend(undefined),'sqlite')
  assert.equal(resolveIdentityBackend('sqlite'),'sqlite')
  assert.equal(resolveIdentityBackend('postgres'),'postgres')
})

test('KAN-791 identity backend rejects unknown configuration rather than fallback',()=>{
  for(const value of ['SQLITE','pg','unknown','postgres,sqlite']) {
    assert.throws(()=>resolveIdentityBackend(value),/backend/)
  }
})
