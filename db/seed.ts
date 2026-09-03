import { db } from '@/db/index'
import {
  athleteGroups,
  athleteProfiles,
  groupSessionPrescriptions,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
  shoes as shoesTable,
  teams,
  trainingGoals,
  trainingLocations,
  users,
  workoutLogs,
  workouts as workoutsTable,
} from '@/db/schema'

import {
  currentAthlete,
  currentUser,
  runningShoes,
  team,
  TRAINING_LOCATIONS,
  weekDaysRaw,
  weeklyCycle,
  workouts,
} from '@/data/data'

import type {
  AthleteCategoryCode,
  AthleteGroupCode,
  AthleteLevelCode,
  DayStatus,
  MicrocycleType,
  PeriodType,
  TrainingGoalStatus,
  TrainingGoalType,
  UserRole,
} from '@/types'

interface SeededAthleteGroup {
  id: string
  teamId: string
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
  description: string
  isActive: boolean
}

function splitGroupCode(groupCode: AthleteGroupCode): {
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
} {
  return {
    categoryCode: groupCode[0] as AthleteCategoryCode,
    levelCode: groupCode[1] as AthleteLevelCode,
  }
}

function getDayStatus(day: (typeof weekDaysRaw)[number]): DayStatus {
  if (day.isRest) return 'rest'
  if (day.isDone) return 'completed'
  if (day.isPartial) return 'partial'
  if (day.isMissed) return 'missed'

  return 'pending'
}

async function seed() {
  console.log('🌱 Poblando base de datos SQLite con data.ts...')

  const now = new Date().toISOString()

  const userId = String(currentUser.id || 'user_1')
  const teamId = String(team.id || 'team_1')
  const athleteProfileId = `profile_${userId}`

  const trainingGoalId = `training_goal_${athleteProfileId}`
  const groupTrainingPlanId = 'group_plan_1'
  const macrocycleId = 'macro_1'
  const mesocycleId = 'meso_1'
  const microcycleId = String(weeklyCycle.id || 'micro_1')

  const currentGroupCode: AthleteGroupCode = 'S2'

  /*
   * En el mock actual solamente necesitamos garantizar que exista
   * el grupo del atleta. Si queremos mostrar todos los grupos en el
   * dashboard, podemos ampliar este array.
   */
  const availableGroupCodes: AthleteGroupCode[] = ['M1', 'S2', 'B3']

  const athleteGroupRows: SeededAthleteGroup[] = availableGroupCodes.map((groupCode) => {
    const { categoryCode, levelCode } = splitGroupCode(groupCode)

    return {
      id: `${teamId}_${groupCode}`,
      teamId,
      categoryCode,
      levelCode,
      description: `Grupo ${groupCode}`,
      isActive: true,
    }
  })

  const currentGroup = athleteGroupRows.find((group) => `${group.categoryCode}${group.levelCode}` === currentGroupCode)

  if (!currentGroup) {
    throw new Error(`No se encontró el grupo inicial ${currentGroupCode}`)
  }

  const getGroupId = (groupCode: AthleteGroupCode) => {
    const group = athleteGroupRows.find((candidate) => `${candidate.categoryCode}${candidate.levelCode}` === groupCode)

    if (!group) {
      throw new Error(`No se encontró el grupo ${groupCode}`)
    }

    return group.id
  }

  // -----------------------------------------------------------------------
  // 1. Ubicaciones de entrenamiento
  // -----------------------------------------------------------------------

  const locationRows = Object.entries(TRAINING_LOCATIONS).map(([key, location]) => ({
    key,
    name: location.name,
    lon: location.lon,
    lat: location.lat,
  }))

  await db.insert(trainingLocations).values(locationRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 2. Equipo
  // -----------------------------------------------------------------------

  await db
    .insert(teams)
    .values({
      id: teamId,
      name: team.name,
      description: team.description ?? null,
      avatarLight: team.avatarLight ?? null,
      avatarDark: team.avatarDark ?? null,
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 3. Grupos del equipo
  // -----------------------------------------------------------------------

  await db
    .insert(athleteGroups)
    .values(
      athleteGroupRows.map((group) => ({
        id: group.id,
        teamId: group.teamId,
        categoryCode: group.categoryCode,
        levelCode: group.levelCode,
        description: group.description,
        isActive: group.isActive,
      })),
    )
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 4. Usuarios
  // -----------------------------------------------------------------------

  await db
    .insert(users)
    .values({
      id: userId,

      role: (currentUser.role || 'athlete') as UserRole,

      userName: currentUser.userName || `${currentUser.firstName.toLowerCase()}.${currentUser.lastName.toLowerCase()}`,

      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      avatar: currentUser.avatar || null,
    })
    .onConflictDoNothing()
    .run()

  const testUserRows = [
    {
      id: 'user_2',
      role: 'athlete' as const,
      userName: 'ana.acosta',
      email: 'ana.acosta@elparque.test',
      firstName: 'Ana',
      lastName: 'Acosta',
      avatar: null,
    },
    {
      id: 'user_3',
      role: 'athlete' as const,
      userName: 'bruno.benitez',
      email: 'bruno.benitez@elparque.test',
      firstName: 'Bruno',
      lastName: 'Benítez',
      avatar: '/avatars/avatar-2.png',
    },
    {
      id: 'user_4',
      role: 'athlete' as const,
      userName: 'carla.diaz',
      email: 'carla.diaz@elparque.test',
      firstName: 'Carla',
      lastName: 'Díaz',
      avatar: '/avatars/avatar-3.png',
    },
    {
      id: 'user_5',
      role: 'athlete' as const,
      userName: 'diego.fernandez',
      email: 'diego.fernandez@elparque.test',
      firstName: 'Diego',
      lastName: 'Fernández',
      avatar: null,
    },
    {
      id: 'user_6',
      role: 'athlete' as const,
      userName: 'elena.gomez',
      email: 'elena.gomez@elparque.test',
      firstName: 'Elena',
      lastName: 'Gómez',
      avatar: '/avatars/avatar-4.png',
    },
  ]

  await db.insert(users).values(testUserRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 5. Perfiles de atletas
  // -----------------------------------------------------------------------

  await db
    .insert(athleteProfiles)
    .values({
      id: athleteProfileId,
      userId,
      teamId,
      groupId: currentGroup.id,

      nickName: currentAthlete.nickName || null,
      dni: currentAthlete.dni || '12345678A',
      birthday: currentAthlete.birthday || null,

      phone: currentAthlete.phone || null,
      emergencyContact: currentAthlete.emergencyContact || null,
      emergencyPhone: currentAthlete.emergencyPhone || null,
    })
    .onConflictDoNothing()
    .run()

  const testAthleteRows = [
    {
      id: 'profile_user_2',
      userId: 'user_2',
      teamId,
      groupId: getGroupId('S2'),
      nickName: 'Ani',
      dni: '30111222',
      birthday: '1988-03-12',
      phone: '+54 9 264 111-2202',
      emergencyContact: null,
      emergencyPhone: null,
    },
    {
      id: 'profile_user_3',
      userId: 'user_3',
      teamId,
      groupId: getGroupId('S2'),
      nickName: null,
      dni: '32333444',
      birthday: '1990-07-21',
      phone: '+54 9 264 111-2203',
      emergencyContact: null,
      emergencyPhone: null,
    },
    {
      id: 'profile_user_4',
      userId: 'user_4',
      teamId,
      groupId: getGroupId('M1'),
      nickName: 'Car',
      dni: '34555666',
      birthday: '1994-11-05',
      phone: null,
      emergencyContact: null,
      emergencyPhone: null,
    },
    {
      id: 'profile_user_5',
      userId: 'user_5',
      teamId,
      groupId: getGroupId('B3'),
      nickName: null,
      dni: '36777888',
      birthday: '1997-01-18',
      phone: '+54 9 264 111-2205',
      emergencyContact: null,
      emergencyPhone: null,
    },
    {
      id: 'profile_user_6',
      userId: 'user_6',
      teamId,
      groupId: null,
      nickName: 'Ele',
      dni: '38999000',
      birthday: '1999-09-30',
      phone: '+54 9 264 111-2206',
      emergencyContact: null,
      emergencyPhone: null,
    },
  ]

  await db.insert(athleteProfiles).values(testAthleteRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 6. Objetivo individual del atleta
  // -----------------------------------------------------------------------

  await db
    .insert(trainingGoals)
    .values({
      id: trainingGoalId,
      athleteId: athleteProfileId,

      type: 'race' satisfies TrainingGoalType,
      status: 'active' satisfies TrainingGoalStatus,

      title: 'Carrera objetivo',
      description: 'Objetivo inicial utilizado para poblar el entorno de desarrollo.',

      targetDate: '2026-12-31',

      raceName: 'Carrera objetivo',
      raceDistanceKm: 42,
      raceElevationGain: null,

      notes: null,
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 7. Plan grupal y jerarquía temporal actual
  // -----------------------------------------------------------------------

  await db
    .insert(groupTrainingPlans)
    .values({
      id: groupTrainingPlanId,
      groupId: currentGroup.id,
      title: 'Planificación anual 2026',
      status: 'active',
      notes: null,
    })
    .onConflictDoNothing()
    .run()

  await db
    .insert(macrocycles)
    .values({
      id: macrocycleId,

      title: 'Planificación anual 2026',
      groupTrainingPlanId,

      startDate: weeklyCycle.startDate,
      endDate: weeklyCycle.endDate,

      taperingWeeksCount: 2,
      notes: null,
    })
    .onConflictDoNothing()
    .run()

  await db
    .insert(mesocycles)
    .values({
      id: mesocycleId,
      macrocycleId,

      title: 'Mesociclo de desarrollo',
      number: 1,

      period: 'specific_preparatory' satisfies PeriodType,

      objective: 'Aumentar volumen y fuerza específica.',
    })
    .onConflictDoNothing()
    .run()

  await db
    .insert(microcycles)
    .values({
      id: microcycleId,
      mesocycleId,

      weekNumber: weeklyCycle.weekNumber || 1,

      type: (weeklyCycle.type || 'development') as MicrocycleType,

      startDate: weeklyCycle.startDate,
      endDate: weeklyCycle.endDate,

      targetVolumeKm: weeklyCycle.targetKm || 40,
      targetElevationGain: null,
      targetDurationMin: null,

      notes: null,
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 8. Catálogo de workouts
  // -----------------------------------------------------------------------

  const workoutRows = Object.entries(workouts).map(([id, workout]) => ({
    id: String(id),

    title: workout.title,
    type: workout.type,
    zone: workout.zone || 'Z2',

    distance: Number(workout.distance ?? 0),
    time: Number(workout.time ?? 0),
    gain: Number(workout.gain ?? 0),
    pace: workout.pace != null ? Number(workout.pace) : null,

    notes: workout.notes || null,
    trackPath: workout.trackPath || null,

    locationKey: 'locationKey' in workout ? workout.locationKey || null : null,

    structure: null,
  }))

  await db.insert(workoutsTable).values(workoutRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 9. Sesiones compartidas del equipo
  // -----------------------------------------------------------------------

  const sessionRows = weekDaysRaw
    .filter((day) => !day.isRest)
    .map((day, index) => {
      const linkedWorkout = day.workoutId !== undefined ? workouts[day.workoutId] : null

      return {
        id: `session_${index}`,
        teamId,

        workoutId: day.workoutId !== undefined ? String(day.workoutId) : null,

        date: day.date,

        title: linkedWorkout?.title || 'Entrenamiento',
        type: linkedWorkout?.type ?? day.type ?? 'Base',

        locationKey: linkedWorkout && 'locationKey' in linkedWorkout ? linkedWorkout.locationKey || null : null,

        trackPath: linkedWorkout?.trackPath || null,
        structure: null,

        notes: linkedWorkout?.notes || null,
      }
    })

  if (sessionRows.length > 0) {
    await db.insert(sessions).values(sessionRows).onConflictDoNothing().run()
  }

  // -----------------------------------------------------------------------
  // 10. Prescripciones del grupo para cada sesión
  // -----------------------------------------------------------------------

  const prescriptionRows = sessionRows.map((session) => {
    const day = weekDaysRaw.find((candidate) => candidate.date === session.date)

    const linkedWorkout = day?.workoutId !== undefined ? workouts[day.workoutId] : null

    return {
      id: `prescription_${session.id}_${currentGroup.id}`,

      sessionId: session.id,
      groupId: currentGroup.id,
      microcycleId,

      distanceKm: linkedWorkout?.distance != null ? Number(linkedWorkout.distance) : null,

      durationMin: linkedWorkout?.time != null ? Number(linkedWorkout.time) : null,

      elevationGain: linkedWorkout?.gain != null ? Number(linkedWorkout.gain) : null,

      zone: linkedWorkout?.zone || null,
      notes: linkedWorkout?.notes || null,
    }
  })

  if (prescriptionRows.length > 0) {
    await db.insert(groupSessionPrescriptions).values(prescriptionRows).onConflictDoNothing().run()
  }

  // -----------------------------------------------------------------------
  // 11. Registros de ejecución del atleta
  // -----------------------------------------------------------------------

  const workoutLogRows = sessionRows.map((session) => {
    const day = weekDaysRaw.find((candidate) => candidate.date === session.date)

    if (!day) {
      throw new Error(`No se encontraron datos para ${session.date}`)
    }

    const linkedWorkout = day.workoutId !== undefined ? workouts[day.workoutId] : null

    return {
      id: `log_${userId}_${day.date}`,

      athleteId: athleteProfileId,
      sessionId: session.id,

      workoutId: day.workoutId !== undefined ? String(day.workoutId) : null,

      date: day.date,
      status: getDayStatus(day),

      distanceKm: Number(day.completedKm ?? 0),

      durationMin: Number(linkedWorkout?.time ?? 0),

      elevationGain: Number(linkedWorkout?.gain ?? 0),

      avgHr: null,
      feeling: null,
      rpe: 0,
      athleteNotes: null,

      loggedAt: now,
    }
  })

  if (workoutLogRows.length > 0) {
    await db.insert(workoutLogs).values(workoutLogRows).onConflictDoNothing().run()
  }

  // -----------------------------------------------------------------------
  // 12. Calzado
  // -----------------------------------------------------------------------

  const shoeRows = runningShoes.map((shoe, index) => ({
    id: `shoe_${index + 1}`,
    athleteId: athleteProfileId,

    type: shoe.type || 'Trail',
    brand: shoe.brand || 'Marca genérica',
    model: shoe.model || 'Modelo genérico',

    maxKm: Number(shoe.maxKm || 800),
    currentKm: Number(shoe.currentKm || 0),

    purchaseDate: null,
    retiredAt: null,
    notes: null,

    isActive: shoe.status !== 'retired',
    isDefault: index === 0,
  }))

  if (shoeRows.length > 0) {
    await db.insert(shoesTable).values(shoeRows).onConflictDoNothing().run()
  }

  console.log('✅ Base de datos SQLite inicializada correctamente.')
}

seed().catch((error) => {
  console.error('❌ Error al inicializar la base de datos:', error)

  process.exitCode = 1
})
