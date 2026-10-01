import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const card = readFileSync('features/athlete-planning/components/AthleteSessionCard.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/realized-training/workouts.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en/realized-training/workouts.json', 'utf8'))

test('KAN-572 localizes the athlete plan workout type and execution guidance without exposing domain identifiers', () => {
  assert.match(card, /useTranslations\(['"]Workouts['"]\)/)
  assert.match(card, /types\.\$\{session\.type\}/)
  assert.match(card, /card\.guidance\.talkTest\.\$\{executionGuidance\.zone\.talkTest\}/)
  assert.match(card, /card\.guidance\.terrainPriority\.\$\{executionGuidance\.zone\.terrainPriority\}/)
  assert.doesNotMatch(card, /\{session\.type\}<\/Badge>/)
  assert.doesNotMatch(card, /executionGuidance\.zone\.terrainPriority === ['"]effort_over_pace['"]/)

  for (const messages of [es, en]) {
    const workouts = messages.Workouts
    for (const type of ['Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Rest', 'Race']) {
      assert.equal(typeof workouts.types[type], 'string')
      assert.ok(workouts.types[type].length > 0)
    }
    for (const talkTest of ['comfortable_conversation', 'full_conversation', 'short_phrases', 'few_words', 'no_conversation']) {
      assert.equal(typeof workouts.card.guidance.talkTest[talkTest], 'string')
    }
    assert.equal(typeof workouts.card.guidance.terrainPriority.effort_over_pace, 'string')
  }
})
