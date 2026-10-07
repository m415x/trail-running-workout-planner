import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('KAN-666 sporting-group list distinguishes unauthorized from authorized empty state', () => {
  const action = readFileSync(resolve('app/actions/group-actions.ts'), 'utf8')
  const page = readFileSync(resolve('app/[locale]/dashboard/groups/page.tsx'), 'utf8')

  assert.match(
    action,
    /return\s*\{\s*success:\s*false as const,[\s\S]*error:\s*['"]No autorizado['"]/,
    'group reads must preserve an explicit unauthorized result instead of collapsing deny to []',
  )

  assert.match(
    action,
    /return\s*\{\s*success:\s*true as const,[\s\S]*data:/,
    'authorized group reads must return an explicit success result',
  )

  assert.match(
    page,
    /!result\.success/,
    'groups page must branch on denied read state',
  )

  assert.match(
    page,
    /role=['"]alert['"]/,
    'groups page must render denied access as an alert',
  )

  assert.match(
    page,
    /result\.data\.length\s*===\s*0/,
    'authorized empty Team must remain distinguishable from denied access',
  )
})
