import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actionPath = path.join(process.cwd(), 'app/actions/athlete-actions.ts')
const formPath = path.join(process.cwd(), 'features/athletes/components/AthleteForm.tsx')

test('Athlete Create/Edit share an authoritative birthday invariant that rejects future dates', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /athleteFormSchema/)
  assert.match(source, /birthday:/)
  assert.match(source, /getCurrentDateInArgentina/)
  assert.match(source, /birthday[^\n]*(?:refine|superRefine)|(?:refine|superRefine)[\s\S]*birthday/)
  assert.match(source, /createAthlete[\s\S]*athleteFormSchema\.safeParse/)
  assert.match(source, /updateAthlete[\s\S]*athleteFormSchema\.safeParse/)
})

test('Athlete birthday field prevents choosing a future date in the UI', () => {
  const source = fs.readFileSync(formPath, 'utf8')

  assert.match(source, /name=['"]birthday['"]/)
  assert.match(source, /type=['"]date['"]/)
  assert.match(source, /max=/)
})


test('New Athlete page uses canonical localized header copy', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/new/page.tsx'), 'utf8')

  assert.doesNotMatch(page, /Nuevo atleta|Creá el perfil del atleta|La asignación de grupo se gestiona por separado/)
  assert.match(page, /getTranslations/)
  assert.match(page, /AthleteForm/)
})
