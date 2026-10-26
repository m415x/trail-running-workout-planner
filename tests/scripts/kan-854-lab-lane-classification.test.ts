import assert from 'node:assert/strict'
import test from 'node:test'
import { isKan854LabOnlyTest, KAN854_LAB_ONLY_TESTS } from '../../scripts/test-runner'

test('KAN-854 historical lab lane excludes only explicitly reviewed HTTP/Chrome files', () => {
  assert.equal(KAN854_LAB_ONLY_TESTS.size, 5)
  for (const filename of KAN854_LAB_ONLY_TESTS) {
    assert.equal(isKan854LabOnlyTest('C:/repo/tests/i18n/' + filename), true)
    assert.equal(isKan854LabOnlyTest('C:\\repo\\tests\\i18n\\' + filename), true)
    assert.equal(isKan854LabOnlyTest('C:/repo/tests/scripts/' + filename), false)
  }
})

test('KAN-854 runner keeps deterministic and new unknown tests in the ordinary lane', () => {
  for (const name of [
    'kan-854-http-capture-chain.test.ts',
    'kan-854-http-observation-contract.test.ts',
    'kan-854-t3-integrated-deny-boundaries.test.ts',
    'kan-854-real-app-anonymous-http.test.ts',
    'kan-854-t5-c-get-matrix.test.ts',
    'kan-854-new-unknown-regression.test.ts',
    'sqlite-upgrade-contract.test.ts',
  ]) assert.equal(isKan854LabOnlyTest('C:/repo/tests/i18n/' + name), false, name)
})
