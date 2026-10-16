import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const athleteCssPath = 'features/athlete-typography/typography.css'
const globalsPath = 'app/globals.css'

test('KAN-359/T2 defines an Athlete-only semantic typography scale, independent of user preference', () => {
  const css = readFileSync(athleteCssPath, 'utf8')
  assert.match(css, /\.athlete-typography\s*\{/)
  for (const role of ['display', 'heading', 'title', 'body', 'body-compact', 'label', 'caption', 'data']) {
    assert.match(css, new RegExp(`--athlete-text-${role}\\s*:\\s*[^;]+;`))
  }
  assert.doesNotMatch(css, /--font-scale|--athlete-font-scale/)
})

test('KAN-359/T2 supplies explicit responsive tokens without replacing the mobile 120 percent baseline', () => {
  const css = readFileSync(athleteCssPath, 'utf8')
  assert.match(css, /@media\s*\(min-width:\s*640px\)/)
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/)
  const globals = readFileSync(globalsPath, 'utf8')
  assert.match(globals, /html\s*\{[^}]*font-size:\s*120%/s)
  assert.match(globals, /@media\s*\(min-width:\s*640px\)\s*\{\s*html\s*\{\s*font-size:\s*100%/s)
})

test('KAN-359/T2 cannot restyle html, body, Coach or globally override font sizes', () => {
  const css = readFileSync(athleteCssPath, 'utf8')
  assert.doesNotMatch(css, /(?:^|[},\n])\s*(?:html|body|:root|\.coach-[\w-]+)\s*\{/m)
  assert.doesNotMatch(css, /!important|@import|font-size\s*:\s*120%/)
})
