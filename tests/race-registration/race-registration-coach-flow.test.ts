import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildCourseRegistrationInteraction,
  buildBulkRegistrationConfirmation,
  buildBulkRegistrationFeedback,
} from '@/lib/competitions/race-registration-coach-flow'

describe('coach race registration interaction model', () => {
  it('offers only eligible athletes for selection and keeps existing registrations as context', () => {
    const interaction = buildCourseRegistrationInteraction({
      eligible: [
        { athleteProfileId: 'athlete-3', athleteName: 'Pedro' },
        { athleteProfileId: 'athlete-4', athleteName: 'Lucía' },
      ],
      registeredHere: [
        { athleteProfileId: 'athlete-1', athleteName: 'Ana', courseLabel: '21K' },
      ],
      registeredElsewhere: [
        { athleteProfileId: 'athlete-2', athleteName: 'Juan', courseLabel: '30K' },
      ],
    })

    assert.deepEqual(interaction.selectableAthletes.map((athlete) => athlete.athleteProfileId), [
      'athlete-3',
      'athlete-4',
    ])
    assert.deepEqual(interaction.alreadyRegistered, [
      { athleteProfileId: 'athlete-1', athleteName: 'Ana', courseLabel: '21K', relation: 'here' },
      { athleteProfileId: 'athlete-2', athleteName: 'Juan', courseLabel: '30K', relation: 'elsewhere' },
    ])
  })

  it('builds a Level 2 review summary from the exact selected athletes and target', () => {
    const confirmation = buildBulkRegistrationConfirmation({
      athleteNames: ['Ana', 'Juan', 'Pedro'],
      editionLabel: 'Ansilta XK 2026',
      courseLabel: '21K',
    })

    assert.deepEqual(confirmation, {
      variant: 'primary',
      title: 'Confirmar inscripción',
      description: 'Estás por inscribir a Ana, Juan y Pedro en Ansilta XK 2026 · 21K.',
      confirmLabel: 'Inscribir 3 atletas',
    })
  })

  it('reports partial success without hiding athletes rejected during server revalidation', () => {
    const feedback = buildBulkRegistrationFeedback({
      targetCourseLabel: '21K',
      result: {
        requested: 3,
        succeeded: 2,
        failed: 1,
        registrations: [
          { athleteProfileId: 'athlete-1', registrationId: 'registration-1' },
          { athleteProfileId: 'athlete-3', registrationId: 'registration-3' },
        ],
        failures: [
          {
            athleteProfileId: 'athlete-2',
            reason: 'already_registered_in_edition',
            existingCourseLabel: '30K',
          },
        ],
      },
      athleteNamesById: new Map([
        ['athlete-1', 'Ana'],
        ['athlete-2', 'Juan'],
        ['athlete-3', 'Pedro'],
      ]),
    })

    assert.deepEqual(feedback, {
      summary: '2 de 3 atletas fueron inscriptos en 21K.',
      failures: ['Juan no fue inscripto: ya tiene una inscripción en 30K.'],
    })
  })
})
