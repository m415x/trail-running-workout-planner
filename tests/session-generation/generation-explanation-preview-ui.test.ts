import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'features',
    'planning',
    'components',
    'SessionGenerationPreview.tsx',
  ),
  'utf8',
)

test('Coach preview receives generation explanations separately from the proposal', () => {
  assert.match(source, /GenerationExplanation/)
  assert.match(
    source,
    /generationExplanations:\s*Record<string,\s*GenerationExplanation>/,
  )
  assert.match(
    source,
    /name='generationExplanations'\s+value=\{JSON\.stringify\(generationExplanations\)\}/,
  )
  assert.match(
    source,
    /name='proposal'\s+value=\{JSON\.stringify\(proposal\)\}/,
  )
})

test('Coach preview exposes explanation per generated prescription, not as one global Session reason', () => {
  assert.match(
    source,
    /generationExplanations\[generationKey\]/,
  )
  assert.match(
    source,
    /generationKey/,
  )
  assert.match(
    source,
    /<details[\s\S]*generationExplanation[\s\S]*<\/details>/,
  )
})

test('new explanation copy is available in ES and EN', () => {
  assert.match(source, /Por qué se generó así/)
  assert.match(source, /Why it was generated this way/)
  assert.match(source, /Entradas|Inputs/)
  assert.match(source, /Restricciones|Constraints/)
  assert.match(source, /Decisión|Decision/)
  assert.match(source, /Consecuencia|Consequence/)
})

test('preview preserves approved causal stage order when rendering explanation', () => {
  assert.match(source, /GENERATION_EXPLANATION_STAGE_ORDER/)
  assert.match(
    source,
    /weekly_budget[\s\S]*frequency[\s\S]*slots[\s\S]*stimulus_template[\s\S]*fixed_load[\s\S]*remaining_budget[\s\S]*flexible_allocation[\s\S]*intensity[\s\S]*coordination_reconciliation/,
  )
})
