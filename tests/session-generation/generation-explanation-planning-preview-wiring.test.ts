import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'app',
    '[locale]',
    'dashboard',
    'planning',
    '[planId]',
    'page.tsx',
  ),
  'utf8',
)

test('planning preview keeps the exact generation input beside each weekly result', () => {
  assert.match(source, /SessionGenerationInput/)
  assert.match(
    source,
    /const generationRuns:[\s\S]*input:[\s\S]*result:/,
  )
  assert.match(
    source,
    /const generationInput:[\s\S]*SessionGenerationInput/,
  )
  assert.match(
    source,
    /const generationResult = generateWeeklySessionProposals\(generationInput\)/,
  )
  assert.match(
    source,
    /generationRuns\.push\(\{[\s\S]*input:\s*generationInput[\s\S]*result:\s*generationResult/,
  )
})

test('generation explanations are composed only after shared-event coordination exists', () => {
  const sharedIndex = source.indexOf('const sharedPreview = groupSharedSessionEvents')
  const explanationsIndex = source.indexOf('const generationExplanations')
  assert.ok(sharedIndex >= 0)
  assert.ok(explanationsIndex > sharedIndex)

  assert.match(source, /buildGenerationExplanation/)
  assert.match(
    source,
    /for \(const \{ input, result \} of generationRuns\)/,
  )
  assert.match(
    source,
    /for \(const proposal of result\.proposals\)/,
  )
  assert.match(
    source,
    /generationExplanations\[proposal\.generationKey\]\s*=\s*buildGenerationExplanation\(\{/,
  )
  assert.match(
    source,
    /sharedGeneration:\s*sharedPreview/,
  )
  assert.match(
    source,
    /generationKey:\s*proposal\.generationKey/,
  )
  assert.match(
    source,
    /planningCohortId:\s*plan\.planningCohortId/,
  )
})

test('Coach preview receives the real explanation map rather than a placeholder', () => {
  assert.match(
    source,
    /generationExplanations=\{generationExplanations\}/,
  )
  assert.doesNotMatch(
    source,
    /generationExplanations=\{\{\}\}/,
  )
})
