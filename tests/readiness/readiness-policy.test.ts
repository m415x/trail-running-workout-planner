import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  H12_READINESS_POLICY_DRAFT_V1,
  validateReadinessPolicy,
} from '@/lib/readiness/readiness-policy'

describe('readiness policy', () => {
  it('mantiene identificable la versión y el estado draft de los umbrales iniciales', () => {
    assert.equal(H12_READINESS_POLICY_DRAFT_V1.version, 'h12-readiness-v1-draft')
    assert.equal(H12_READINESS_POLICY_DRAFT_V1.status, 'draft')
    assert.equal(H12_READINESS_POLICY_DRAFT_V1.dataSufficiency.lookbackDays, 28)
  })

  it('rechaza ratios inválidos en vez de aceptar configuración silenciosamente', () => {
    assert.throws(() => validateReadinessPolicy({
      ...H12_READINESS_POLICY_DRAFT_V1,
      continuity: { minimumActiveBucketRatio: 1.2 },
    }), /minimumActiveBucketRatio/)
  })

  it('permite cambiar umbrales sin mutar la política base', () => {
    const adjusted = validateReadinessPolicy({
      ...H12_READINESS_POLICY_DRAFT_V1,
      version: 'coach-candidate',
      continuity: { minimumActiveBucketRatio: 0.5 },
    })

    assert.equal(adjusted.continuity.minimumActiveBucketRatio, 0.5)
    assert.equal(H12_READINESS_POLICY_DRAFT_V1.continuity.minimumActiveBucketRatio, 0.75)
  })
})
