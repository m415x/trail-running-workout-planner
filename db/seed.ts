import { db } from '@/db/index'
import {
  teams,
  trainingLocations,
  users,
  microcycles,
  workouts as workoutsTable,
  dailyLogs,
  shoes as shoesTable,
} from '@/db/schema'
import { team, currentUser, TRAINING_LOCATIONS, weeklyCycle, workouts, weekDaysRaw, runningShoes } from '@/data/data'

async function seed() {
  console.log('🌱 Poblando base de datos SQLite con data.ts...')

  // 1. Ubicaciones
  const locationsData = Object.entries(TRAINING_LOCATIONS).map(([key, loc]) => ({
    key: key as keyof typeof TRAINING_LOCATIONS,
    name: loc.name,
    lat: loc.lat,
    lon: loc.lon,
  }))
  db.insert(trainingLocations).values(locationsData).onConflictDoNothing().run()

  // 2. Team
  db.insert(teams)
    .values({
      id: team.id,
      name: team.name,
      avatarLight: team.avatarLight,
      avatarDark: team.avatarDark,
    })
    .onConflictDoNothing()
    .run()

  // 3. Usuario Actual
  db.insert(users)
    .values({
      id: currentUser.id,
      teamId: team.id,
      role: currentUser.role,
      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      nickName: currentUser.nickName,
      dni: currentUser.dni,
      birthday: currentUser.birthday,
      phone: currentUser.phone,
      emergencyContact: currentUser.emergencyContact,
      emergencyPhone: currentUser.emergencyPhone,
      avatar: currentUser.avatar,
      group: currentUser.group,
    })
    .onConflictDoNothing()
    .run()

  // 4. Ciclo Semanal (Microciclo)
  db.insert(microcycles)
    .values({
      id: weeklyCycle.id,
      title: weeklyCycle.title,
      phase: weeklyCycle.phase,
      startDate: weeklyCycle.startDate,
      endDate: weeklyCycle.endDate,
      targetKm: weeklyCycle.targetKm,
    })
    .onConflictDoNothing()
    .run()

  // 5. Workouts
  const workoutRows = Object.entries(workouts).map(([id, w]) => ({
    id: String(id),
    title: w.title,
    type: w.type ?? 'Base',
    zone: w.zone ?? 'Z2',
    distance: w.distance,
    time: w.time,
    gain: w.gain,
    pace: w.pace,
    notes: w.notes,
    trackPath: w.trackPath ?? null,
  }))
  db.insert(workoutsTable).values(workoutRows).onConflictDoNothing().run()

  // 6. Logs Diarios (weekDaysRaw del usuario)
  const logsRows = weekDaysRaw.map((d) => ({
    id: `${currentUser.id}_${d.date}`,
    userId: currentUser.id,
    date: d.date,
    workoutId: d.workoutId !== undefined ? String(d.workoutId) : null,
    type: d.type ?? (d.isRest ? 'Rest' : null),
    completedKm: d.completedKm ?? null,
    isDone: Boolean(d.isDone),
    isPartial: Boolean(d.isPartial),
    isMissed: Boolean(d.isMissed),
    isRest: Boolean(d.isRest),
  }))
  db.insert(dailyLogs).values(logsRows).onConflictDoNothing().run()

  // 7. Zapatillas
  const shoesRows = runningShoes.map((s, index) => ({
    id: `shoe_${index + 1}`,
    userId: currentUser.id,
    name: s.name,
    type: s.type,
    currentKm: s.km,
    maxKm: s.maxKm,
    status: s.status,
    isDefault: index === 0,
  }))
  db.insert(shoesTable).values(shoesRows).onConflictDoNothing().run()

  console.log(' Base de datos SQLite inicializada y sincronizada con éxito.')
}

seed().catch((err) => {
  console.error('❌ Error ejecutando el seed:', err)
})
