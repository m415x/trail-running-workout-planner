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

test('Coach review gets explanations from the authorized server snapshot without uploading either payload', () => {
  assert.match(source, /reviewedSnapshot/)
  assert.match(source, /reviewedSnapshot\?\.generationExplanations/)
  assert.match(source, /displayedExplanations/)
  assert.match(source, /name='snapshotId'/)
  assert.doesNotMatch(source, /name='generationExplanations'|name='proposal'/)
})

test('Coach review exposes per-prescription causal evidence from the durable review', () => {
  assert.match(source, /displayedExplanations\[generationKey\]/)
  assert.match(source, /generationKey/)
  assert.match(source, /<details[\s\S]*generationExplanation[\s\S]*<\/details>/)
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
