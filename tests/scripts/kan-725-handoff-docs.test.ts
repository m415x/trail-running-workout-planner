import assert from 'node:assert/strict'
import test from 'node:test'

import { validateOperationalHandoff } from '@/scripts/check-handoff-docs'

const current = `# Current operational handoff — KAN-609/H6 merged baseline

## Verified integration
- KAN-609/H6: **Finalizada**.
- PR #48 was merged to dev.
`

const index = `# Documentation index

## Handoffs

[handoffs/current.md](handoffs/current.md) records the completed KAN-609/H6 merged checkpoint, with details in [handoffs/kan-609.md](handoffs/kan-609.md).
`

test('KAN-725 accepts a current handoff whose story-specific handoff is indexed', () => {
  assert.deepEqual(
    validateOperationalHandoff({
      currentContent: current,
      docsIndexContent: index,
      availableHandoffs: ['current.md', 'kan-609.md'],
    }),
    [],
  )
})

test('KAN-725 rejects stale or incomplete durable handoff publication', () => {
  const errors = validateOperationalHandoff({
    currentContent: current,
    docsIndexContent: `## Handoffs

[handoffs/current.md](handoffs/current.md) follows KAN-608 PR #47 merge.
`,
    availableHandoffs: ['current.md'],
  })

  assert.ok(errors.some((error) => error.includes('kan-609.md')))
  assert.ok(errors.some((error) => error.includes('KAN-609')))
})


test('KAN-725 rejects a current story mentioned outside the Handoffs section while that section is stale', () => {
  const errors = validateOperationalHandoff({
    currentContent: `# Current operational handoff — KAN-725 Harness v2 merged baseline

## Verified integration
- KAN-725: **Finalizada**.
`,
    docsIndexContent: `# Documentation index

## Handoffs

[handoffs/current.md](handoffs/current.md) records the completed KAN-609/H6 merged checkpoint, with details in [handoffs/kan-609.md](handoffs/kan-609.md).

## Agent harness

KAN-725 introduced Harness v2. See [handoffs/kan-725.md](handoffs/kan-725.md).
`,
    availableHandoffs: ['current.md', 'kan-609.md', 'kan-725.md'],
  })

  assert.ok(errors.some((error) => error.includes('Handoffs section')))
})
