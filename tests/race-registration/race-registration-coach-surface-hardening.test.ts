import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const actions = readFileSync('app/actions/race-registration-actions.ts', 'utf8')
const course = readFileSync('features/race-registration/components/CourseRegistration.tsx', 'utf8')
const edition = readFileSync('features/race-registration/components/EditionRegistrations.tsx', 'utf8')

describe('KAN-366 Coach surface hardening', () => {
  it('uses the actual bulk action export and validates participation status explicitly', () => {
    assert.match(course, /registerAthletesForRaceCourse/)
    assert.doesNotMatch(course, /raceRegistrationAction/)

    assert.match(actions, /function parseRaceParticipationStatus/)
    assert.match(actions, /case ['"]unknown['"][\s\S]*case ['"]started['"][\s\S]*case ['"]finished['"][\s\S]*case ['"]dnf['"][\s\S]*case ['"]dns['"]/)
    assert.doesNotMatch(actions, /as RaceParticipationStatus/)
  })

  it('localizes Coach registration surfaces instead of shipping hardcoded Spanish copy', () => {
    assert.match(course, /getTranslations|useTranslations/)
    assert.match(edition, /getTranslations|useTranslations/)

    assert.doesNotMatch(course, /Atletas inscriptos|Confirmar inscripciones|Inscribir seleccionados|Solicitadas:/)
    assert.doesNotMatch(edition, /Inscripciones|Participación|Distancia real|Guardar resultado/)
  })
})
