import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const header = readFileSync('features/profile/components/ProfileHeader.tsx', 'utf8')
const css = readFileSync('features/athlete-typography/typography.css', 'utf8')

test('KAN-825/T9e Athlete Profile identity scales with the same responsive heading as Home and Stats', () => {
  assert.match(header, /<h1 className='[^']*text-\[length:var\(--athlete-text-heading\)\][^']*'>\{displayName\}<\/h1>/)
  assert.match(header, /<p className='[^']*text-\[length:var\(--athlete-text-caption\)\][^']*'>/)
  assert.match(header, /<Avatar className='size-20/)
  assert.match(header, /\{athlete\.group \?/)
})

test('KAN-825/T9e standard preserves KAN-563 Profile heading responsive visual base', () => {
  assert.match(css, /--athlete-text-heading:\s*calc\(1\.5rem\s*\*\s*var\(--athlete-type-multiplier\)\);/)
  assert.match(css, /@media\s*\(min-width:\s*640px\)\s*\{\s*\.athlete-typography\s*\{[^}]*--athlete-text-heading:\s*calc\(1\.875rem\s*\*\s*var\(--athlete-type-multiplier\)\);/)
  assert.match(css, /\.athlete-typography\[data-athlete-typography='standard'\]\s*\{\s*--athlete-type-multiplier:\s*1;/)
  assert.doesNotMatch(header, /text-2xl[^'"]*sm:text-3xl/)
})
