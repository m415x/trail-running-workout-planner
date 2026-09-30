import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const componentPath = path.join(
  process.cwd(),
  'features',
  'planning',
  'components',
  'GenerationExplanationView.tsx',
)
const previewSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'features',
    'planning',
    'components',
    'SessionGenerationPreview.tsx',
  ),
  'utf8',
)
const detailSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'app',
    '[locale]',
    'dashboard',
    'sessions',
    '[sessionId]',
    'page.tsx',
  ),
  'utf8',
)

test('GenerationExplanationView renders the approved causal order and structured evidence', () => {
  const source = fs.readFileSync(componentPath, 'utf8')

  assert.match(source, /GENERATION_EXPLANATION_STAGE_ORDER/)
  assert.match(source, /evidence\.inputs/)
  assert.match(source, /evidence\.constraints/)
  assert.match(source, /evidence\.decision/)
  assert.match(source, /evidence\.consequence/)
  assert.match(source, /evidence\.warnings/)
  assert.match(source, /warning\.facts/)
})

test('GenerationExplanationView provides ES and EN labels without exposing source_warning prose', () => {
  const source = fs.readFileSync(componentPath, 'utf8')

  assert.match(source, /Entradas/)
  assert.match(source, /Inputs/)
  assert.match(source, /Restricciones/)
  assert.match(source, /Constraints/)
  assert.match(source, /Decisión/)
  assert.match(source, /Decision/)
  assert.match(source, /Consecuencia/)
  assert.match(source, /Consequence/)
  assert.match(source, /Avisos/)
  assert.match(source, /Warnings/)
  assert.doesNotMatch(source, /source_warning/)
})

test('Coach preview and Session detail reuse the same explanation renderer', () => {
  assert.match(previewSource, /GenerationExplanationView/)
  assert.match(detailSource, /GenerationExplanationView/)

  assert.doesNotMatch(
    detailSource,
    /Decisiones.*stage\.decision\.length|Decisions.*stage\.decision\.length/,
  )
  assert.doesNotMatch(
    detailSource,
    /Consecuencias.*stage\.consequence\.length|Consequences.*stage\.consequence\.length/,
  )
})

test('Session detail exposes coordination evidence through the historical snapshot', () => {
  assert.match(detailSource, /generationExplanation=\{item\.generationExplanation\}/)
  assert.match(detailSource, /planningScope/)
  assert.match(detailSource, /generationOwnership/)
})
