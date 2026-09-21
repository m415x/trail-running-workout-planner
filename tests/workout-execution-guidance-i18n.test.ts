import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('WorkoutCard localizes execution guidance instead of exposing internal enum values', async () => {
  const cardSource = await readFile('features/workouts/components/WorkoutCard.tsx', 'utf8')\n  const pillSource = await readFile('components/ui/custom/pills.tsx', 'utf8')
  const es = await readFile('messages/es/realized-training/workouts.json', 'utf8')
  const en = await readFile('messages/en/realized-training/workouts.json', 'utf8')

  assert.match(cardSource, /executionGuidance/)
  assert.match(cardSource, /card[.]guidance[.]talkTest/)
  assert.match(cardSource, /card[.]guidance[.]terrainPriority/)
  assert.doesNotMatch(cardSource, />Talk Test:/)
  assert.doesNotMatch(cardSource, /['"]effort_over_pace['"]\s*:\s*['"]effort_over_pace['"]/)

  for (const messages of [es, en]) {
    assert.match(messages, /"guidance"/)
    assert.match(messages, /"comfortable_conversation"/)
    assert.match(messages, /"full_conversation"/)
    assert.match(messages, /"short_phrases"/)
    assert.match(messages, /"few_words"/)
    assert.match(messages, /"no_conversation"/)
    assert.match(messages, /"effort_over_pace"/)
  }
})
