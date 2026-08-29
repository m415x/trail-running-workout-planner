import { db } from '@/db/index'
import {
  teams,
  trainingLocations,
  users,
  athleteProfiles,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
  workouts as workoutsTable,
  workoutLogs,
  shoes as shoesTable,
} from '@/db/schema'

// Asumimos que estos datos existen en tu data.ts.
// Si faltan campos (como userName o brand), he añadido fallbacks seguros.
import { team, currentUser, TRAINING_LOCATIONS, weeklyCycle, workouts, weekDaysRaw, runningShoes } from '@/data/data'

async function seed() {
  console.log('🌱 Poblando base de datos SQLite con data.ts...')

  const userId = String(currentUser.id || 'user_1')
  const athleteProfileId = `profile_${userId}`
  const macroId = 'macro_1'
  const mesoId = 'meso_1'
  const microId = String(weeklyCycle.id || 'micro_1')

  // -----------------------------------------------------------------------
  // 1. Ubicaciones de Entrenamiento
  // -----------------------------------------------------------------------
  const locationsData = Object.entries(TRAINING_LOCATIONS).map(([key, loc]) => ({
    key: key as keyof typeof TRAINING_LOCATIONS,
    name: loc.name,
    lon: loc.lon,
    lat: loc.lat,
  }))
  await db.insert(trainingLocations).values(locationsData).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 2. Equipo (Team)
  // -----------------------------------------------------------------------
  await db
    .insert(teams)
    .values({
      id: team.id,
      name: team.name,
      description: team.description,
      avatarLight: team.avatarLight,
      avatarDark: team.avatarDark,
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 3. Usuario Base (Solo datos de autenticación y perfil público)
  // -----------------------------------------------------------------------
  await db
    .insert(users)
    .values({
      id: userId,
      role: (currentUser.role || 'athlete') as 'athlete' | 'coach' | 'admin',
      userName: currentUser.userName || `${currentUser.firstName.toLowerCase()}.${currentUser.lastName.toLowerCase()}`,
      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      avatar: currentUser.avatar || null,
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 4. Perfil de Atleta (Datos deportivos, fisiológicos y de equipo)
  // -----------------------------------------------------------------------
  await db
    .insert(athleteProfiles)
    .values({
      id: athleteProfileId,
      userId: userId,
      teamId: team.id ? String(team.id) : null,
      group: (currentUser.group || 'B3') as any,
      nickName: currentUser.nickName || null,
      dni: currentUser.dni || '12345678A',
      birthday: currentUser.birthday || null,
      phone: currentUser.phone || null,
      emergencyContact: currentUser.emergencyContact || null,
      emergencyPhone: currentUser.emergencyPhone || null,
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 5. Jerarquía de Periodización (Macro -> Meso -> Micro)
  // -----------------------------------------------------------------------
  await db
    .insert(macrocycles)
    .values({
      id: macroId,
      group: (currentUser.group || 'B3') as any,
      title: 'Planificación Anual 2024',
      targetRaceName: 'Carrera Objetivo',
      targetRaceDate: '2026-12-31',
      startDate: weeklyCycle.startDate,
      endDate: weeklyCycle.endDate,
      taperingWeeksCount: 2,
    })
    .onConflictDoNothing()
    .run()

  await db
    .insert(mesocycles)
    .values({
      id: mesoId,
      macrocycleId: macroId,
      title: 'Mesociclo de Desarrollo',
      number: 1,
      period: 'specific_preparatory', // Coincide con PeriodType
      objective: 'Aumentar volumen y fuerza específica',
    })
    .onConflictDoNothing()
    .run()

  await db
    .insert(microcycles)
    .values({
      id: microId,
      mesocycleId: mesoId,
      weekNumber: weeklyCycle.weekNumber || 1,
      type: (weeklyCycle.type || 'development') as any,
      startDate: weeklyCycle.startDate,
      endDate: weeklyCycle.endDate,
      targetVolumeKmByGroup: { [currentUser.group || 'B3']: weeklyCycle.targetKm || 40 },
      notes: 'Ninguna Nota',
    })
    .onConflictDoNothing()
    .run()

  // -----------------------------------------------------------------------
  // 6. Catálogo de Workouts (Plantillas)
  // -----------------------------------------------------------------------
  const workoutRows = Object.entries(workouts).map(([id, w]) => ({
    id: String(id),
    type: (w.type || 'Base') as any,
    title: w.title,
    distance: Number(w.distance ?? 0),
    zone: (w.zone || 'Z2') as any,
    time: Number(w.time ?? 0),
    gain: Number(w.gain ?? 0),
    pace: Number(w.pace ?? 0),
    notes: w.notes || null,
    trackPath: w.trackPath || null,
  }))
  await db.insert(workoutsTable).values(workoutRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 7. Sessions (Días específicos en el calendario del microciclo)
  // -----------------------------------------------------------------------
  const sessionRows = weekDaysRaw.map((d, index) => {
    const linkedWorkout = d.workoutId !== undefined ? workouts[d.workoutId] : null
    return {
      id: `session_${index}`,
      microcycleId: microId,
      workoutId: d.workoutId !== undefined ? String(d.workoutId) : null,
      date: d.date,
      title: d.isRest ? 'Descanso' : linkedWorkout?.title || 'Entrenamiento',
      type: (d.isRest ? 'rest' : d.type || 'workout') as any,
      zone: (linkedWorkout?.zone || 'Z2') as any,
      defaultVolume: {
        km: Number(linkedWorkout?.distance || d.completedKm || 0),
        timeMin: Number(linkedWorkout?.time || 0),
      },
    }
  })
  await db.insert(sessions).values(sessionRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 8. Workout Logs (Registro de ejecución del atleta)
  // -----------------------------------------------------------------------
  // Función auxiliar para mapear los booleanos antiguos al nuevo DayStatus
  const getStatus = (d: any) => {
    if (d.isRest) return 'rest'
    if (d.isDone) return 'completed'
    if (d.isPartial) return 'partial'
    if (d.isMissed) return 'missed'
    return 'pending'
  }

  const logRows = weekDaysRaw.map((d, index) => {
    const linkedWorkout = d.workoutId !== undefined ? workouts[d.workoutId] : null
    return {
      id: `log_${userId}_${d.date}`,
      athleteId: athleteProfileId, // ✅ Ahora usa athleteId
      sessionId: `session_${index}`,
      workoutId: d.workoutId !== undefined ? String(d.workoutId) : null,
      date: d.date,
      status: getStatus(d) as any,
      distanceKm: Number(d.completedKm ?? 0),
      durationMin: Number(linkedWorkout?.time ?? 0),
      elevationGain: Number(linkedWorkout?.gain ?? 0),
      rpe: 0,
      loggedAt: new Date().toISOString(),
    }
  })
  await db.insert(workoutLogs).values(logRows).onConflictDoNothing().run()

  // -----------------------------------------------------------------------
  // 9. Zapatillas (Gear)
  // -----------------------------------------------------------------------
  const shoesRows = runningShoes.map((s, index) => ({
    id: `shoe_${index + 1}`,
    athleteId: athleteProfileId, // ✅ AHORA USA athleteId
    type: s.type || 'Trail',
    brand: s.brand || 'Marca Genérica', // Asegúrate de que 'brand' exista en data.ts
    model: s.model || 'Modelo Genérico',
    maxKm: s.maxKm || 800,
    currentKm: s.km || 0,
    isActive: s.status === 'active', // Ajusta según cómo tengas 'status' en data.ts
    isDefault: index === 0,
  }))
  await db.insert(shoesTable).values(shoesRows).onConflictDoNothing().run()

  console.log('✅ Base de datos SQLite inicializada y sincronizada con éxito.')
}

seed().catch((err) => {
  console.error('❌ Error ejecutando el seed:', err)
})
