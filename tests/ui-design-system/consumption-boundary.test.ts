import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const designSystemDoc = readFileSync(
  'docs/architecture/platform/ui-design-system.md',
  'utf8',
)
const packageJson = readFileSync('package.json', 'utf8')
const tsconfig = readFileSync('tsconfig.json', 'utf8')

test('KAN-562 exposes a durable Git-first consumption contract', () => {
  assert.match(tsconfig, /"@ui\/\*":\s*\["\.\/components\/ui\/\*"\]/)

  for (const phrase of [
    'Consumption contract',
    '@ui/',
    '@ui/custom/',
    'Base primitives',
    'Official EPT semantic primitives',
    'Product patterns',
    'Feature compositions',
    'app/globals.css',
  ]) {
    assert.ok(
      designSystemDoc.includes(phrase),
      `missing Design System consumption contract: ${phrase}`,
    )
  }
})

test('KAN-562 leaves application-wide normalization explicitly to KAN-508', () => {
  for (const phrase of [
    'KAN-508 migration boundary',
    'typography hierarchy',
    'forms and controls',
    'cards and surfaces',
    'loading, empty and error states',
    'responsive composition',
    'direct presentation literals',
  ]) {
    assert.ok(
      designSystemDoc.toLowerCase().includes(phrase.toLowerCase()),
      `missing KAN-508 migration boundary: ${phrase}`,
    )
  }
})

test('KAN-562 keeps Storybook optional and external experimental tooling outside the durable authority', () => {
  assert.doesNotMatch(packageJson, /storybook/i)
  assert.match(
    designSystemDoc,
    /Storybook[\s\S]*(not introduced|not added|remains out)/i,
  )
  assert.match(
    designSystemDoc,
    /Figma[\s\S]*(auxiliary|does not override)/i,
  )
  assert.match(
    designSystemDoc,
    /Archify[\s\S]*(outside|not part of)[\s\S]*(DoD|T1–T8|T1-T8)/i,
  )
})
