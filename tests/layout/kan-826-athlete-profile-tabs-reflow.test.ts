import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const profile = readFileSync('features/profile/ProfileTab.tsx', 'utf8')
const shared = readFileSync('components/ui/tabs.tsx', 'utf8')

function classNames(tag: 'TabsList' | 'TabsTrigger', value?: 'athlete' | 'settings') {
  const re = new RegExp('<' + tag + (value ? "\\s+value='" + value + "'" : '') + "\\s+className='([^']+)'")
  const match = profile.match(re)
  assert.ok(match, 'missing Profile ' + tag + (value ? ' ' + value : ''))
  return match[1].split(/\s+/)
}

test('KAN-826 Profile tabs can grow and remain viewport-constrained rather than relying on a fixed-height content-sized strip', () => {
  const list = classNames('TabsList')
  assert.ok(list.includes('grid-cols-2'), 'two real tabs remain in the grid')
  assert.ok(list.includes('w-full'), 'tab strip fills the available Profile width')
  assert.ok(list.includes('h-auto'), 'tab strip grows with scaled and wrapped labels')
  assert.ok(list.includes('group-data-horizontal/tabs:h-auto'), 'override higher-specificity horizontal height from shared TabsList')
  assert.ok(list.includes('min-w-0'), 'tab strip can shrink in narrow layout')
  assert.ok(list.includes('max-w-full'), 'tab strip cannot exceed its parent')
  assert.ok(!list.includes('h-10'), 'fixed 40px height clips zoomed/wrapped labels')
  assert.ok(!list.includes('sm:w-auto'), 'content-sized tablet strip cannot account for scaling/zoom')
})

test('KAN-826 both real tabs wrap long ES/EN labels without hiding text or reducing touch height', () => {
  for (const value of ['athlete', 'settings'] as const) {
    const classes = classNames('TabsTrigger', value)
    assert.ok(classes.includes('min-w-0'), value + ' must shrink within one of two columns')
    assert.ok(classes.includes('min-h-11'), value + ' retains a >=44px minimum target')
    assert.ok(classes.includes('h-auto'), value + ' grows for multiline labels')
    assert.ok(classes.includes('whitespace-normal'), value + ' overrides shared nowrap and enables text reflow')
    assert.ok(classes.includes('break-words'), value + ' allows long translations to wrap')
    assert.ok(classes.includes('text-center'), value + ' retains centered label after wrapping')
    assert.ok(classes.includes('text-[length:var(--athlete-text-label)]'), 'existing four-preset scale preserved')
    assert.ok(!classes.includes('truncate'), 'no ellipsis hiding text')
    assert.ok(!classes.includes('overflow-hidden'), 'no clipping that disguises overflow')
  }
  assert.match(profile, /<Tabs defaultValue='athlete'/)
  assert.match(profile, /<TabsContent value='athlete'>/)
  assert.match(profile, /<TabsContent value='settings'>/)
  assert.match(shared, /whitespace-nowrap/, 'shared UI primitive is intentionally unchanged; override is Profile-local')
})
