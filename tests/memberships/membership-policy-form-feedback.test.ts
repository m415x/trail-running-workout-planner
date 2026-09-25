import assert from 'node:assert/strict'
import test from 'node:test'

import { getTeamEconomicPolicyFormFeedback } from '../../lib/memberships/membership-policy-form-feedback'

test('exposes localized pending and error feedback for the Coach policy form', () => {
  assert.deepEqual(getTeamEconomicPolicyFormFeedback('es'), {
    pendingLabel: 'Guardando…',
    genericError: 'No se pudo guardar la política económica.',
  })

  assert.deepEqual(getTeamEconomicPolicyFormFeedback('en'), {
    pendingLabel: 'Saving…',
    genericError: 'The economic policy could not be saved.',
  })
})
