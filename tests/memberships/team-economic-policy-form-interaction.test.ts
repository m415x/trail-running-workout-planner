import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('TeamEconomicPolicyForm wires the Coach action with pending and error feedback', async () => {
  const source = await readFile(
    'features/memberships/components/TeamEconomicPolicyForm.tsx',
    'utf8',
  )

  assert.match(source, /['"]use client['"]/)
  assert.match(source, /configureTeamEconomicPolicyAction/)
  assert.match(source, /createTeamEconomicPolicyFormController/)
  assert.match(source, /getTeamEconomicPolicyFormFeedback/)
  assert.match(source, /useTransition/)
  assert.match(source, /disabled=\{isPending\}/)
  assert.match(source, /role=['"]alert['"]/)
  assert.match(source, /locale/)
})

test('TeamEconomicPolicyForm does not duplicate server revalidation', async () => {
  const source = await readFile(
    'features/memberships/components/TeamEconomicPolicyForm.tsx',
    'utf8',
  )

  assert.doesNotMatch(source, /revalidatePath/)
})
