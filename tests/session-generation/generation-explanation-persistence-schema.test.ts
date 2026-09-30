import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  groupSessionPrescriptions,
  sessions,
  sessionGenerationModificationRecords,
} from '@/db/schema'

describe('GenerationExplanation historical persistence schema', () => {
  it('anchors the structured snapshot only on append-only generation audit records', () => {
    assert.equal(
      sessionGenerationModificationRecords.generationExplanation.name,
      'generation_explanation',
    )
    assert.equal(
      sessionGenerationModificationRecords.generationExplanation.notNull,
      false,
    )

    assert.equal('generationExplanation' in sessions, false)
    assert.equal('generationExplanation' in groupSessionPrescriptions, false)
  })

  it('keeps historical compatibility by allowing legacy audit rows without a snapshot', () => {
    assert.equal(
      sessionGenerationModificationRecords.generationExplanation.hasDefault,
      false,
    )
    assert.equal(
      sessionGenerationModificationRecords.generationExplanation.notNull,
      false,
    )
  })
})
