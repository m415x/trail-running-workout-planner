import type { db as sqliteDb } from '@/db/index'
import { athleteProfiles, users } from '@/db/schema'
import { currentAthlete, currentUser } from '@/data/data'
import { createSeedContext } from '@/db/seeds/context'

import type { SeededAthleteGroup } from '@/db/seeds/groups'
import type { UserRole } from '@/types'

type SeedDb = typeof sqliteDb

function groupId(groups: SeededAthleteGroup[], code: string): string {
  const group = groups.find((candidate) => `${candidate.categoryCode}${candidate.levelCode}` === code)
  if (!group) throw new Error(`Missing seed group dependency: ${code}`)
  return group.id
}

export async function seedAthletes(db: SeedDb, groups: SeededAthleteGroup[]): Promise<void> {
  const { teamId } = createSeedContext()
  const userId = String(currentUser.id || 'user_1')

  const userRows = [
    {
      id: userId,
      role: (currentUser.role || 'athlete') as UserRole,
      userName: currentUser.userName || `${currentUser.firstName.toLowerCase()}.${currentUser.lastName.toLowerCase()}`,
      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      avatar: currentUser.avatar || null,
    },
    { id: 'user_2', role: 'athlete' as const, userName: 'ana.acosta', email: 'ana.acosta@elparque.test', firstName: 'Ana', lastName: 'Acosta', avatar: null },
    { id: 'user_3', role: 'athlete' as const, userName: 'bruno.benitez', email: 'bruno.benitez@elparque.test', firstName: 'Bruno', lastName: 'Benítez', avatar: '/avatars/avatar-2.png' },
    { id: 'user_4', role: 'athlete' as const, userName: 'carla.diaz', email: 'carla.diaz@elparque.test', firstName: 'Carla', lastName: 'Díaz', avatar: '/avatars/avatar-3.png' },
    { id: 'user_5', role: 'athlete' as const, userName: 'diego.fernandez', email: 'diego.fernandez@elparque.test', firstName: 'Diego', lastName: 'Fernández', avatar: null },
    { id: 'user_6', role: 'athlete' as const, userName: 'elena.gomez', email: 'elena.gomez@elparque.test', firstName: 'Elena', lastName: 'Gómez', avatar: '/avatars/avatar-4.png' },
  ]
  await db.insert(users).values(userRows).onConflictDoNothing().run()

  const athleteProfileId = `profile_${userId}`
  await db.insert(athleteProfiles).values([
    {
      id: athleteProfileId,
      userId,
      teamId,
      groupId: groupId(groups, 'S2'),
      nickName: currentAthlete.nickName || null,
      dni: currentAthlete.dni || '12345678A',
      birthday: currentAthlete.birthday || null,
      phone: currentAthlete.phone || null,
      emergencyContact: currentAthlete.emergencyContact || null,
      emergencyPhone: currentAthlete.emergencyPhone || null,
    },
    { id: 'profile_user_2', userId: 'user_2', teamId, groupId: groupId(groups, 'S2'), nickName: 'Ani', dni: '30111222', birthday: '1988-03-12', phone: '+54 9 264 111-2202', emergencyContact: null, emergencyPhone: null },
    { id: 'profile_user_3', userId: 'user_3', teamId, groupId: groupId(groups, 'S2'), nickName: null, dni: '32333444', birthday: '1990-07-21', phone: '+54 9 264 111-2203', emergencyContact: null, emergencyPhone: null },
    { id: 'profile_user_4', userId: 'user_4', teamId, groupId: groupId(groups, 'M1'), nickName: 'Car', dni: '34555666', birthday: '1994-11-05', phone: null, emergencyContact: null, emergencyPhone: null },
    { id: 'profile_user_5', userId: 'user_5', teamId, groupId: groupId(groups, 'B3'), nickName: null, dni: '36777888', birthday: '1997-01-18', phone: '+54 9 264 111-2205', emergencyContact: null, emergencyPhone: null },
    { id: 'profile_user_6', userId: 'user_6', teamId, groupId: null, nickName: 'Ele', dni: '38999000', birthday: '1999-09-30', phone: '+54 9 264 111-2206', emergencyContact: null, emergencyPhone: null },
  ]).onConflictDoNothing().run()
}
