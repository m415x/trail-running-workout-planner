import { currentUser, team } from '@/data/data'

export interface SeedContext {
  teamId: string
  userId: string
  athleteProfileId: string
}

export function createSeedContext(): SeedContext {
  const userId = String(currentUser.id || 'user_1')

  return {
    teamId: String(team.id || 'team_1'),
    userId,
    athleteProfileId: `profile_${userId}`,
  }
}
