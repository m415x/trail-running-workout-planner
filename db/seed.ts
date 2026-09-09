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
import { loadStrategies } from '@/db/load-strategy-schema'
import { intensityStrategies, microcycleIntensityTargets } from '@/db/intensity-strategy-schema'
import { sessionGenerationPreferences } from '@/db/session-generation-preferences-schema'

import { currentAthlete, currentUser, runningShoes, team, TRAINING_LOCATIONS, weekDaysRaw, workouts } from '@/data/data'

import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

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

interface SeedMesocycleDefinition {
  key: string
  title: string
  period: PeriodType
  objective: string
  weeks: MicrocycleType[]
}

interface SeedPlanDefinition {
  key: string
  groupCode: AthleteGroupCode
  title: string
  raceName: string
  raceDistanceKm: number
  raceElevationGain: number
  taperingWeeksCount: 0 | 2 | 3
  sessionsPerWeek: number
  mesocycles: SeedMesocycleDefinition[]
}

interface SeededMicrocycle {
  id: string
  mesocycleId: string
  weekNumber: number
  type: MicrocycleType
  startDate: string
  endDate: string
  targetVolumeKm: number
  targetVolumeSource: 'generated'
  targetElevationGain: number
  targetElevationSource: 'generated'
  targetDurationMin: null
  notes: string | null
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

function formatISODate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function shiftISODate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)

  return formatISODate(date)
}

function getCurrentDateInArgentina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function getMondayFromISODate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7

  date.setUTCDate(date.getUTCDate() - offset)

  return formatISODate(date)
}

/**
 * Produces a representative weekly planning value from the group's load
 * strategy without introducing a second source of truth for group volume.
 */
function resolveMicrocycleVolume(
  type: MicrocycleType,
  initialVolume: number,
  maximumVolume: number,
  deloadPercentage: number,
  raceDistanceKm: number,
) {
  const developmentVolume = initialVolume + (maximumVolume - initialVolume) * 0.55

  switch (type) {
    case 'base':
      return initialVolume

    case 'development':
      return developmentVolume

    case 'shock':
      return maximumVolume

    case 'deload':
      return initialVolume * (1 - deloadPercentage / 100)

    case 'tapering':
      return initialVolume * 0.7

    case 'race':
      return Math.max(raceDistanceKm, initialVolume * 0.55)

    default:
      return initialVolume
  }
}

/**
 * Builds deterministic seed microcycles while deriving their volume and D+
 * from the same load strategy used by the real planning domain.
 */
function buildPlanMicrocycles(
  plan: SeedPlanDefinition,
  planStartDate: string,
  mesocycleIds: Map<string, string>,
): SeededMicrocycle[] {
  const loadStrategy = suggestLoadStrategy(plan.groupCode, 'race')
  const { initialWeeklyVolumeKm, maximumWeeklyVolumeKm, deloadPercentage, initialWeeklyElevationGain } =
    loadStrategy.values

  const elevationMetersPerKm =
    initialWeeklyElevationGain != null && initialWeeklyVolumeKm > 0
      ? initialWeeklyElevationGain / initialWeeklyVolumeKm
      : 0

  const result: SeededMicrocycle[] = []
  let globalWeekIndex = 0

  for (const mesocycle of plan.mesocycles) {
    const mesocycleId = mesocycleIds.get(mesocycle.key)

    if (!mesocycleId) {
      throw new Error(`No se encontró el mesociclo ${mesocycle.key} para ${plan.key}`)
    }

    for (const type of mesocycle.weeks) {
      const targetVolumeKm = Number(
        resolveMicrocycleVolume(
          type,
          initialWeeklyVolumeKm,
          maximumWeeklyVolumeKm,
          deloadPercentage,
          plan.raceDistanceKm,
        ).toFixed(1),
      )

      const calculatedElevation = Math.round(targetVolumeKm * elevationMetersPerKm)

      const targetElevationGain =
        type === 'race' ? Math.max(calculatedElevation, plan.raceElevationGain) : calculatedElevation

      result.push({
        id: `${plan.key}_micro_${globalWeekIndex + 1}`,
        mesocycleId,
        weekNumber: globalWeekIndex + 1,
        type,
        startDate: shiftISODate(planStartDate, globalWeekIndex * 7),
        endDate: shiftISODate(planStartDate, globalWeekIndex * 7 + 6),
        targetVolumeKm,
        targetVolumeSource: 'generated',
        targetElevationGain,
        targetElevationSource: 'generated',
        targetDurationMin: null,
        notes: null,
      })

      globalWeekIndex += 1
    }
  }

  return result
}

/**
 * Defines generated intensity intent for fixtures without replacing the
 * planning-domain intensity rules used by production generation.
 */
function buildIntensityTarget(planKey: string, microcycle: SeededMicrocycle) {
  const common = {
    id: `${planKey}_intensity_${microcycle.weekNumber}`,
    microcycleId: microcycle.id,
    minimumRecoveryDaysBetweenIntenseSessions: 2,
    fieldSources: {
      intenseSessionsTarget: 'generated',
      predominantZone: 'generated',
      pamPercentageTarget: 'generated',
      minimumRecoveryDaysBetweenIntenseSessions: 'generated',
    } as const,
  }

  switch (microcycle.type) {
    case 'deload':
      return {
        ...common,
        emphasis: 'recovery' as const,
        intenseSessionsTarget: 0,
        predominantZone: 'Z1' as const,
        pamPercentageTarget: null,
      }

    case 'shock':
      return {
        ...common,
        emphasis: 'threshold' as const,
        intenseSessionsTarget: 2,
        predominantZone: 'Z3' as const,
        pamPercentageTarget: 95,
      }

    case 'tapering':
      return {
        ...common,
        emphasis: 'aerobic' as const,
        intenseSessionsTarget: 1,
        predominantZone: 'Z2' as const,
        pamPercentageTarget: 90,
      }

    case 'race':
      return {
        ...common,
        emphasis: 'race_specific' as const,
        intenseSessionsTarget: 1,
        predominantZone: 'Z2' as const,
        pamPercentageTarget: 92.5,
      }

    case 'development':
      return {
        ...common,
        emphasis: 'tempo' as const,
        intenseSessionsTarget: 2,
        predominantZone: 'Z2' as const,
        pamPercentageTarget: 90,
      }

    case 'base':
    default:
      return {
        ...common,
        emphasis: 'aerobic' as const,
        intenseSessionsTarget: 1,
        predominantZone: 'Z2' as const,
        pamPercentageTarget: null,
      }
  }
}

async function seed() {
  console.log('🌱 Poblando base de datos SQLite...')

  const now = new Date().toISOString()
  const currentWeekStart = getMondayFromISODate(getCurrentDateInArgentina())

  const relativeWeekDays = weekDaysRaw.map((day, index) => ({
    ...day,
    date: shiftISODate(currentWeekStart, index),
  }))

  const userId = String(currentUser.id || 'user_1')
  const teamId = String(team.id || 'team_1')
  const athleteProfileId = `profile_${userId}`
  const trainingGoalId = `training_goal_${athleteProfileId}`

  const currentGroupCode: AthleteGroupCode = 'S2'
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
  // 3. Grupos
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
  // 6. Objetivo individual del atleta actual
  // -----------------------------------------------------------------------
  //
  // El atleta actual pertenece a S2, por lo que el fixture utiliza una
  // carrera Short de 12 km. La validación formal categoría/distancia
  // corresponde a H8 y no se implementa dentro del seed.

  await db
    .insert(trainingGoals)
    .values({
      id: trainingGoalId,
      athleteId: athleteProfileId,
      type: 'race' satisfies TrainingGoalType,
      status: 'active' satisfies TrainingGoalStatus,
      title: 'Short Trail 12K',
      description: 'Objetivo individual de desarrollo alineado con el grupo Short.',
      targetDate: shiftISODate(currentWeekStart, 8 * 7),
      raceName: 'Short Trail 12K',
      raceDistanceKm: 12,
      raceElevationGain: 600,
      notes: null,
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 7. Planificaciones modernas de Epic 2
  // -----------------------------------------------------------------------

  const planDefinitions: SeedPlanDefinition[] = [
    {
      key: 'm1_42k',
      groupCode: 'M1',
      title: 'Plan base M1 — Trail Marathon 42K',
      raceName: 'Trail Marathon 42K',
      raceDistanceKm: 42,
      raceElevationGain: 1800,
      taperingWeeksCount: 2,
      sessionsPerWeek: 5,
      mesocycles: [
        {
          key: 'general',
          title: 'Preparación general',
          period: 'general_preparatory',
          objective: 'Construir base aeróbica, fuerza general y tolerancia progresiva al volumen.',
          weeks: ['base', 'development', 'development', 'deload'],
        },
        {
          key: 'specific',
          title: 'Preparación específica',
          period: 'specific_preparatory',
          objective: 'Desarrollar volumen, desnivel y estímulos específicos de trail maratón.',
          weeks: ['development', 'shock', 'development', 'deload'],
        },
        {
          key: 'competitive',
          title: 'Bloque competitivo',
          period: 'competitive',
          objective: 'Consolidar carga específica, realizar tapering y llegar a la carrera objetivo.',
          weeks: ['development', 'shock', 'tapering', 'race'],
        },
      ],
    },
    {
      key: 's2_12k',
      groupCode: 'S2',
      title: 'Plan base S2 — Short Trail 12K',
      raceName: 'Short Trail 12K',
      raceDistanceKm: 12,
      raceElevationGain: 600,
      taperingWeeksCount: 2,
      sessionsPerWeek: 4,
      mesocycles: [
        {
          key: 'general',
          title: 'Preparación general',
          period: 'general_preparatory',
          objective: 'Consolidar base aeróbica y fuerza para esfuerzos cortos de trail.',
          weeks: ['base', 'development', 'development', 'deload'],
        },
        {
          key: 'specific',
          title: 'Preparación específica y competencia',
          period: 'competitive',
          objective: 'Aumentar especificidad, calidad y frescura para la carrera Short.',
          weeks: ['development', 'shock', 'tapering', 'race'],
        },
      ],
    },
  ]

  const seededMicrocyclesByPlan = new Map<string, SeededMicrocycle[]>()

  for (const plan of planDefinitions) {
    const groupId = getGroupId(plan.groupCode)
    const planId = `group_plan_${plan.key}`
    const macrocycleId = `macro_${plan.key}`

    const totalWeeks = plan.mesocycles.reduce((total, mesocycle) => total + mesocycle.weeks.length, 0)

    const planEndDate = shiftISODate(currentWeekStart, totalWeeks * 7 - 1)

    await db
      .insert(groupTrainingPlans)
      .values({
        id: planId,
        groupId,
        title: plan.title,
        status: 'active',
        notes: 'Fixture de desarrollo para validar el flujo actual de planificación de Epic 2.',
      })
      .onConflictDoNothing()
      .run()

    await db
      .insert(macrocycles)
      .values({
        id: macrocycleId,
        title: plan.title,
        groupTrainingPlanId: planId,
        startDate: currentWeekStart,
        endDate: planEndDate,
        taperingWeeksCount: plan.taperingWeeksCount,
        targetRaceName: plan.raceName,
        targetRaceDistanceKm: plan.raceDistanceKm,
        targetRaceElevationGain: plan.raceElevationGain,
        notes: null,
      })
      .onConflictDoNothing()
      .run()

    const mesocycleIds = new Map<string, string>()

    for (const [index, mesocycle] of plan.mesocycles.entries()) {
      const mesocycleId = `meso_${plan.key}_${mesocycle.key}`

      mesocycleIds.set(mesocycle.key, mesocycleId)

      await db
        .insert(mesocycles)
        .values({
          id: mesocycleId,
          macrocycleId,
          title: mesocycle.title,
          number: index + 1,
          period: mesocycle.period,
          objective: mesocycle.objective,
        })
        .onConflictDoNothing()
        .run()
    }

    const microcycleRows = buildPlanMicrocycles(plan, currentWeekStart, mesocycleIds)

    await db.insert(microcycles).values(microcycleRows).onConflictDoNothing().run()

    seededMicrocyclesByPlan.set(plan.key, microcycleRows)

    // -------------------------------------------------------------------
    // LoadStrategy
    // -------------------------------------------------------------------

    const suggestedLoadStrategy = suggestLoadStrategy(plan.groupCode, 'race')

    await db
      .insert(loadStrategies)
      .values({
        id: `load_strategy_${plan.key}`,
        groupTrainingPlanId: planId,
        goalType: 'race',
        initialWeeklyVolumeKm: suggestedLoadStrategy.values.initialWeeklyVolumeKm,
        maximumWeeklyVolumeKm: suggestedLoadStrategy.values.maximumWeeklyVolumeKm,
        maximumWeeklyIncreasePercentage: suggestedLoadStrategy.values.maximumWeeklyIncreasePercentage,
        deloadPercentage: suggestedLoadStrategy.values.deloadPercentage,
        initialWeeklyElevationGain: suggestedLoadStrategy.values.initialWeeklyElevationGain,
        maximumWeeklyElevationGain: suggestedLoadStrategy.values.maximumWeeklyElevationGain,
        fieldSources: {
          ...suggestedLoadStrategy.fieldSources,
        },
      })
      .onConflictDoNothing()
      .run()

    // -------------------------------------------------------------------
    // IntensityStrategy
    // -------------------------------------------------------------------

    await db
      .insert(intensityStrategies)
      .values({
        id: `intensity_strategy_${plan.key}`,
        groupTrainingPlanId: planId,
        goalType: 'race',
        defaultMethod: 'hr_zone',
        maximumIntenseSessionsPerWeek: 2,
        minimumRecoveryDaysBetweenIntenseSessions: 2,
        fieldSources: {
          defaultMethod: 'suggested',
          maximumIntenseSessionsPerWeek: 'suggested',
          minimumRecoveryDaysBetweenIntenseSessions: 'suggested',
        },
      })
      .onConflictDoNothing()
      .run()

    // -------------------------------------------------------------------
    // SessionGenerationPreferences
    // -------------------------------------------------------------------

    const weeklyPattern =
      plan.groupCode === 'M1'
        ? [
            {
              weekday: 'monday' as const,
              role: 'base' as const,
            },
            {
              weekday: 'tuesday' as const,
              role: 'quality' as const,
            },
            {
              weekday: 'thursday' as const,
              role: 'base' as const,
            },
            {
              weekday: 'saturday' as const,
              role: 'mountain' as const,
            },
            {
              weekday: 'sunday' as const,
              role: 'long' as const,
            },
          ]
        : [
            {
              weekday: 'tuesday' as const,
              role: 'quality' as const,
            },
            {
              weekday: 'thursday' as const,
              role: 'base' as const,
            },
            {
              weekday: 'saturday' as const,
              role: 'mountain' as const,
            },
            {
              weekday: 'sunday' as const,
              role: 'long' as const,
            },
          ]

    await db
      .insert(sessionGenerationPreferences)
      .values({
        id: `session_preferences_${plan.key}`,
        groupTrainingPlanId: planId,
        frequencyMode: 'fixed',
        fixedSessionsPerWeek: plan.sessionsPerWeek,
        weeklyPattern,
      })
      .onConflictDoNothing()
      .run()

    // -------------------------------------------------------------------
    // MicrocycleIntensityTarget
    // -------------------------------------------------------------------

    const intensityTargetRows = microcycleRows.map((microcycle) => buildIntensityTarget(plan.key, microcycle))

    await db.insert(microcycleIntensityTargets).values(intensityTargetRows).onConflictDoNothing().run()
  }

  // -----------------------------------------------------------------------
  // 8. Catálogo de workouts
  // -----------------------------------------------------------------------

  const workoutRows = Object.entries(workouts).map(([id, workout]) => ({
    id: String(id),
    teamId,

    title: workout.title,
    type: workout.type,

    category:
      workout.type === 'Race'
        ? ('competition' as const)
        : workout.type === 'Trail' || workout.type === 'Hills'
          ? ('mountain' as const)
          : workout.type === 'Intervals' ||
              workout.type === 'Speed' ||
              workout.type === 'Fartlek' ||
              workout.type === 'PAM'
            ? ('quality' as const)
            : workout.type === 'Rest'
              ? ('recovery' as const)
              : ('endurance' as const),

    tags: [],
    archivedAt: null,

    distance: workout.distance == null ? null : Number(workout.distance),

    time: workout.time == null ? null : Number(workout.time),

    gain: workout.gain == null ? null : Number(workout.gain),

    intensityMethod: workout.zone ? ('hr_zone' as const) : null,

    zone: workout.zone ?? null,
    pamPercentage: null,

    pace: workout.pace != null ? Number(workout.pace) : null,

    notes: workout.notes || null,
    prescriptionNotes: workout.notes || null,
    trackPath: workout.trackPath || null,

    locationKey: 'locationKey' in workout ? workout.locationKey || null : null,

    structure: null,
  }))

  await db.insert(workoutsTable).values(workoutRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 9. Sesiones legacy de la semana actual
  // -----------------------------------------------------------------------
  //
  // Estas sesiones se conservan únicamente para mantener útil la vista
  // del atleta y sus workout logs. No representan la generación automática
  // de H6 y por eso permanecen con ownership manual.

  const sessionRows = relativeWeekDays
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

        generationOwnership: 'manual' as const,
        sharedEventKey: null,
      }
    })

  if (sessionRows.length > 0) {
    await db.insert(sessions).values(sessionRows).onConflictDoNothing().run()
  }

  // -----------------------------------------------------------------------
  // 10. Prescripciones legacy para S2
  // -----------------------------------------------------------------------

  const s2Microcycles = seededMicrocyclesByPlan.get('s2_12k')

  if (!s2Microcycles || s2Microcycles.length === 0) {
    throw new Error('No se encontraron microciclos del plan S2')
  }

  const prescriptionRows = sessionRows.map((session) => {
    const day = relativeWeekDays.find((candidate) => candidate.date === session.date)

    const linkedWorkout = day?.workoutId !== undefined ? workouts[day.workoutId] : null

    const microcycle =
      s2Microcycles.find((candidate) => session.date >= candidate.startDate && session.date <= candidate.endDate) ??
      s2Microcycles[0]

    return {
      id: `prescription_${session.id}_${currentGroup.id}`,

      sessionId: session.id,
      groupId: currentGroup.id,
      microcycleId: microcycle.id,

      distanceKm: linkedWorkout?.distance != null ? Number(linkedWorkout.distance) : null,

      durationMin: linkedWorkout?.time != null ? Number(linkedWorkout.time) : null,

      elevationGain: linkedWorkout?.gain != null ? Number(linkedWorkout.gain) : null,

      intensityMethod: linkedWorkout?.zone ? ('hr_zone' as const) : null,

      zone: linkedWorkout?.zone || null,
      pamPercentage: null,

      notes: linkedWorkout?.notes || null,

      generationOwnership: 'manual' as const,
      generationKey: null,
    }
  })

  if (prescriptionRows.length > 0) {
    await db.insert(groupSessionPrescriptions).values(prescriptionRows).onConflictDoNothing().run()
  }

  // -----------------------------------------------------------------------
  // 11. Registros de ejecución del atleta
  // -----------------------------------------------------------------------

  const workoutLogRows = sessionRows.map((session) => {
    const day = relativeWeekDays.find((candidate) => candidate.date === session.date)

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
  console.log('   • M1: Trail Marathon 42K — 12 semanas')
  console.log('   • S2: Short Trail 12K — 8 semanas')
  console.log('   • B3: grupo disponible sin planificación competitiva')
}

seed().catch((error) => {
  console.error('❌ Error al inicializar la base de datos:', error)

  process.exitCode = 1
})
