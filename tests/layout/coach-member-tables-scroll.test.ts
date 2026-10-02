import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const groupDetail = readFileSync('app/[locale]/dashboard/groups/[groupId]/page.tsx', 'utf8')
const cohortDetail = readFileSync('app/[locale]/dashboard/cohorts/[cohortId]/page.tsx', 'utf8')

test('KAN-571 keeps Coach member tables reachable on narrow and text-scaled viewports', () => {
  for (const [name, source] of [
    ['Sporting group', groupDetail],
    ['Planning subgroup', cohortDetail],
  ] as const) {
    assert.match(
      source,
      /max-w-full overflow-x-auto rounded-lg border/,
      `${name} member table must scroll horizontally rather than clip columns`,
    )
    assert.doesNotMatch(
      source,
      /overflow-hidden rounded-lg border/,
      `${name} member table must not conceal offscreen controls`,
    )
    assert.match(
      source,
      /tabIndex=\{0\}/,
      `${name} scroll region must be keyboard reachable`,
    )
  }
})
