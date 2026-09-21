import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const CARD_PATH = 'features/athlete-planning/components/AthleteSessionCard.tsx'

test('AthleteSessionCard consumes first-class ExecutionGuidance instead of formatting prescription alone', async () => {
  const source = await readFile(CARD_PATH, 'utf8')

  assert.match(source, /ExecutionGuidance/)
  assert.match(source, /executionGuidance/)
  assert.match(source, /rpe/)
  assert.match(source, /talkTest/)
  assert.match(source, /effort_over_pace/)
})

test('AthleteSessionCard presents referenced percentage pace only when quality guidance is available', async () => {
  const source = await readFile(CARD_PATH, 'utf8')

  assert.match(source, /quality/)
  assert.match(source, /status\s*===\s*['"]available['"]/)
  assert.match(source, /paceLabel/)
  assert.doesNotMatch(source, /maxHr\s*[:=]\s*190/)
  assert.doesNotMatch(source, /restHr\s*[:=]\s*50/)
})
