import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const globalsCss = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

test('KAN-557 exposes an explicit semantic typography scale while preserving the approved mobile root scaling', () => {
  for (const token of [
    '--text-ept-display:',
    '--text-ept-heading:',
    '--text-ept-title:',
    '--text-ept-body:',
    '--text-ept-body-compact:',
    '--text-ept-label:',
    '--text-ept-caption:',
    '--text-ept-data:',
  ]) {
    assert.ok(globalsCss.includes(token), `missing semantic typography token: ${token}`)
  }

  assert.match(globalsCss, /html\s*\{[\s\S]*?font-size:\s*120%/)
  assert.match(
    globalsCss,
    /@media\s*\(min-width:\s*640px\)\s*\{[\s\S]*?html\s*\{[\s\S]*?font-size:\s*100%/,
  )
})

test('KAN-557 separates Brand roles from usage semantics instead of duplicating the palette', () => {
  for (const token of [
    '--brand-action:',
    '--brand-identity:',
    '--brand-highlight:',
  ]) {
    assert.ok(globalsCss.includes(token), `missing Brand role token: ${token}`)
  }

  assert.match(globalsCss, /--primary:\s*var\(--brand-action\)/)
  assert.match(globalsCss, /--secondary:\s*var\(--brand-identity\)/)
  assert.match(globalsCss, /--accent:\s*var\(--brand-highlight\)/)
})
