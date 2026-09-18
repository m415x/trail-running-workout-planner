interface SelectableAthlete {
  athleteProfileId: string
  athleteName: string
}

interface RegisteredAthlete extends SelectableAthlete {
  courseLabel: string
}

export function buildCourseRegistrationInteraction(input: {
  eligible: SelectableAthlete[]
  registeredHere: RegisteredAthlete[]
  registeredElsewhere: RegisteredAthlete[]
}) {
  return {
    selectableAthletes: input.eligible,
    alreadyRegistered: [
      ...input.registeredHere.map((athlete) => ({ ...athlete, relation: 'here' as const })),
      ...input.registeredElsewhere.map((athlete) => ({ ...athlete, relation: 'elsewhere' as const })),
    ],
  }
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} y ${names[1]}`
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

export function buildBulkRegistrationConfirmation(input: {
  athleteNames: string[]
  editionLabel: string
  courseLabel: string
}) {
  return {
    variant: 'primary' as const,
    title: 'Confirmar inscripción',
    description: `Estás por inscribir a ${joinNames(input.athleteNames)} en ${input.editionLabel} · ${input.courseLabel}.`,
    confirmLabel: `Inscribir ${input.athleteNames.length} ${input.athleteNames.length === 1 ? 'atleta' : 'atletas'}`,
  }
}

type BulkRegistrationResult = {
  requested: number
  succeeded: number
  failed: number
  registrations: Array<{ athleteProfileId: string; registrationId: string }>
  failures: Array<{
    athleteProfileId: string
    reason: string
    existingCourseLabel?: string
  }>
}

export function buildBulkRegistrationFeedback(input: {
  targetCourseLabel: string
  result: BulkRegistrationResult
  athleteNamesById: Map<string, string>
}) {
  return {
    summary: `${input.result.succeeded} de ${input.result.requested} atletas fueron inscriptos en ${input.targetCourseLabel}.`,
    failures: input.result.failures.map((failure) => {
      const athleteName = input.athleteNamesById.get(failure.athleteProfileId) ?? failure.athleteProfileId

      if (failure.reason === 'already_registered_in_edition' && failure.existingCourseLabel) {
        return `${athleteName} no fue inscripto: ya tiene una inscripción en ${failure.existingCourseLabel}.`
      }

      return `${athleteName} no fue inscripto.`
    }),
  }
}
