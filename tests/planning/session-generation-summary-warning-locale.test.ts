import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const preview = readFileSync('features/planning/components/SessionGenerationPreview.tsx', 'utf8')

test('KAN-577 Review the proposal renders the localized warning, not the raw warning string', () => {
  assert.match(preview, /event\.warnings\.map\(\(warning\)/)
  assert.match(preview, /warnings\.map\(\(warning\)/)
  assert.match(preview, /<AlertTriangle[^>]+\/> \{formatWarning\(warning\)\}/)
  assert.match(preview, /<li key=\{warning\}>• \{formatWarning\(warning\)\}<\/li>/)
  assert.doesNotMatch(preview, /<li key=\{formatWarning\(warning\)\}>• \{warning\}<\/li>/)
  assert.match(preview, /value=\{JSON\.stringify\(proposal\)\}/)
})
