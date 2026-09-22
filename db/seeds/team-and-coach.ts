import type { db as sqliteDb } from '@/db/index'
import { teams, trainingLocations } from '@/db/schema'
import { team, TRAINING_LOCATIONS } from '@/data/data'
import { createSeedContext } from '@/db/seeds/context'

type SeedDb = typeof sqliteDb

export async function seedTeamAndCoach(db: SeedDb): Promise<void> {
  const locationRows = Object.entries(TRAINING_LOCATIONS).map(([key, location]) => ({
    key,
    name: location.name,
    lon: location.lon,
    lat: location.lat,
  }))

  await db.insert(trainingLocations).values(locationRows).onConflictDoNothing().run()

  const { teamId } = createSeedContext()
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
}
