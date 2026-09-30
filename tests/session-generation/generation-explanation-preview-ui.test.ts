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
const explanationViewSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'features',
    'planning',
    'components',
    'GenerationExplanationView.tsx',
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

test('new explanation copy is consumed through CoachPlanning i18n', () => {
  assert.match(source, /useTranslations\('CoachPlanning'\)/)
  assert.match(source, /t\('whyGenerated'\)/)
  assert.match(explanationViewSource, /useTranslations\('CoachPlanning'\)/)
  assert.match(explanationViewSource, /t\('explanationSections\.inputs'\)/)
  assert.match(explanationViewSource, /t\('explanationSections\.constraints'\)/)
  assert.match(explanationViewSource, /t\('explanationSections\.decision'\)/)
  assert.match(explanationViewSource, /t\('explanationSections\.consequence'\)/)
})

test('preview delegates approved causal stage rendering to the shared explanation view', () => {
  assert.match(source, /GenerationExplanationView/)
  assert.match(explanationViewSource, /GENERATION_EXPLANATION_STAGE_ORDER/)
  assert.match(explanationViewSource, /GENERATION_EXPLANATION_STAGE_ORDER/)
  assert.match(
    explanationViewSource,
    /t\(\`explanationStages\.\$\{evidence\.stage\}\`\)/,
  )
})
