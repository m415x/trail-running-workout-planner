type SelectableAthlete = {
  athleteProfileId: string
  athleteName: string
}

type ExistingRegistration = SelectableAthlete & {
  courseLabel: string
  relation: 'here' | 'elsewhere'
}

export function buildCourseRegistrationViewModel(input: {
  interaction: {
    selectableAthletes: SelectableAthlete[]
    alreadyRegistered: ExistingRegistration[]
  }
  selectedAthleteProfileIds: string[]
}) {
  const selected = new Set(input.selectedAthleteProfileIds)
  const selectableRows = input.interaction.selectableAthletes.map((athlete) => ({
    ...athlete,
    selected: selected.has(athlete.athleteProfileId),
  }))

  return {
    selectableRows,
    contextRows: input.interaction.alreadyRegistered,
    canSubmit: selectableRows.some((athlete) => athlete.selected),
  }
}

export function parseBulkRegistrationSelection(input: {
  submittedAthleteProfileIds: string[]
  selectableAthleteProfileIds: string[]
}) {
  const selectable = new Set(input.selectableAthleteProfileIds)
  const accepted = new Set<string>()

  for (const athleteProfileId of input.submittedAthleteProfileIds) {
    if (selectable.has(athleteProfileId)) accepted.add(athleteProfileId)
  }

  return [...accepted]
}
