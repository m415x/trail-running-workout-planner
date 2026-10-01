import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const designSystemDoc = readFileSync(
  'docs/architecture/platform/ui-design-system.md',
  'utf8',
)

test('KAN-559 freezes the responsive architecture and breakpoint decisions durably', () => {
  for (const phrase of [
    'Coach desktop-first',
    'progressive compression',
    'Athlete mobile-first',
    'progressive expansion',
    'compact persistent bottom bar',
    '640px',
    'four destinations',
    'KAN-358',
    'KAN-359',
  ]) {
    assert.ok(
      designSystemDoc.toLowerCase().includes(phrase.toLowerCase()),
      `missing durable responsive architecture decision: ${phrase}`,
    )
  }
})

test('KAN-559 documents composition and accessibility scaling as independent concerns', () => {
  assert.match(
    designSystemDoc,
    /responsive composition[\s\S]*accessibility scaling/,
  )
  assert.match(designSystemDoc, /120%[\s\S]*100%/)
  assert.match(
    designSystemDoc,
    /navigation rail[\s\S]*(rejected|not selected|not adopted)/i,
  )
  assert.match(
    designSystemDoc,
    /pathname[\s\S]*(active|selection)[\s\S]*(not|does not)[\s\S]*(responsive|layout)/i,
  )
})
