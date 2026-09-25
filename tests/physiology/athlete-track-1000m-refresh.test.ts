import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('athlete 1000m registration refreshes server-rendered stats after success', () => {
  const source = readFileSync(
    'features/field-performance-test/components/AthleteTrack1000mForm.tsx',
    'utf8',
  )

  assert.match(source, /import \{ useRouter \} from 'next\/navigation'/)
  assert.match(source, /const router = useRouter\(\)/)

  const submitStart = source.indexOf('async function submit(')
  const returnStart = source.indexOf('return <form', submitStart)
  assert.notEqual(submitStart, -1)
  assert.notEqual(returnStart, -1)

  const submit = source.slice(submitStart, returnStart)
  assert.match(submit, /if \(result\.success\) router\.refresh\(\)/)
})
