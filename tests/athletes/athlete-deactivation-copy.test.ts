import assert from 'node:assert/strict'
import test from 'node:test'

import en from '../../messages/en/athletes/actions.json'
import es from '../../messages/es/athletes/actions.json'

test('athlete actions provide deactivation confirmation copy in English and Spanish', () => {
  for (const messages of [en.AthleteActions, es.AthleteActions]) {
    assert.ok(messages.deactivateConfirmTitle)
    assert.ok(messages.deactivateConfirmDescription)
    assert.ok(messages.deactivateConfirmAction)
    assert.ok(messages.deactivateConfirmCancel)
  }
})
